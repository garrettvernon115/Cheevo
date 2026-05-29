from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Achievement, Game, Unlock, UserGame
from app.models.user import User
from app.schemas.user import SyncResult
from app.services.openxbl import OpenXBLClient, OpenXBLError, OpenXBLRateLimitError

logger = logging.getLogger(__name__)

# How many per-game achievement fetches to run against OpenXBL at once. The HTTP
# round-trips are the bottleneck; fetching concurrently turns a multi-minute sync
# into seconds. Kept modest to stay friendly to OpenXBL + Microsoft throttling.
SYNC_CONCURRENCY = 8


async def sync_profile(
    xuid: str,
    openxbl: OpenXBLClient,
    db: AsyncSession,
) -> User:
    """Upsert the Xbox profile for xuid into the users table."""
    raw = await openxbl.get_profile(xuid)

    # OpenXBL profile shape: profileUsers[0].settings array of id/value pairs
    profile_users = raw.get("profileUsers", [raw])
    profile = profile_users[0] if profile_users else raw

    settings_list: list[dict] = profile.get("settings", [])
    settings_map = {s["id"]: s["value"] for s in settings_list}

    result = await db.execute(select(User).where(User.xuid == xuid))
    user = result.scalar_one_or_none()
    now = datetime.now(UTC)

    # OpenXBL returns a rate-limit body ({"limitType": ..., "currentRequests": ...})
    # with no profile settings when the request quota is exhausted. Treat a missing
    # Gamertag as "no real data" and never overwrite an existing profile with it —
    # otherwise a rate-limited sync silently wipes the user's gamertag/gamerscore.
    if "Gamertag" not in settings_map:
        if user is not None:
            logger.warning(
                "Profile fetch for %s returned no Gamertag (rate-limited or empty); "
                "keeping existing profile data.", xuid,
            )
            user.last_synced_at = now
            await db.flush()
            return user
        raise OpenXBLError(
            f"Could not load Xbox profile for {xuid} — OpenXBL returned no profile "
            f"data (likely rate-limited). Try again in a few minutes."
        )

    gamertag = settings_map["Gamertag"]
    gamerscore = int(settings_map.get("Gamerscore", 0))
    account_tier = settings_map.get("AccountTier")
    avatar_url = settings_map.get("GameDisplayPicRaw")

    if user is None:
        user = User(
            xuid=xuid,
            gamertag=gamertag,
            gamerscore=gamerscore,
            account_tier=account_tier,
            avatar_url=avatar_url,
            last_synced_at=now,
        )
        db.add(user)
    else:
        user.gamertag = gamertag
        user.gamerscore = gamerscore
        user.account_tier = account_tier
        user.avatar_url = avatar_url
        user.last_synced_at = now

    await db.flush()
    return user


async def sync_games(
    user: User,
    openxbl: OpenXBLClient,
    db: AsyncSession,
) -> list[Game]:
    """Upsert all games for the user. Returns list of Game ORM objects."""
    raw_games = await openxbl.get_games(user.xuid)
    synced_games: list[Game] = []

    for raw in raw_games:
        title_id = str(raw.get("titleId", raw.get("id", "")))
        if not title_id:
            continue

        result = await db.execute(select(Game).where(Game.title_id == title_id))
        game = result.scalar_one_or_none()

        name = raw.get("name", raw.get("titleName", "Unknown"))
        platform = _extract_platform(raw)
        cover_url = _extract_cover(raw)

        # Completion data lives under the nested "achievement" object
        ach_summary = raw.get("achievement", {}) or {}
        total_gs = int(ach_summary.get("totalGamerscore", raw.get("maxGamerscore", 0)))
        total_ach = int(ach_summary.get("totalAchievements", raw.get("maxAchievements", 0)))
        current_gs = int(ach_summary.get("currentGamerscore", 0))
        current_ach = int(ach_summary.get("currentAchievements", 0))

        # Last played and playtime come from titleHistory
        title_history = raw.get("titleHistory", {}) or {}
        last_played = _parse_dt(title_history.get("lastTimePlayed"))
        minutes_played = int(raw.get("minutesPlayed", 0) or title_history.get("minutesPlayed", 0) or 0)

        if game is None:
            game = Game(
                title_id=title_id,
                name=name,
                platform=platform,
                total_gamerscore=total_gs,
                total_achievements=total_ach,
                cover_url=cover_url,
            )
            db.add(game)
        else:
            game.name = name
            game.platform = platform
            game.total_gamerscore = total_gs
            game.total_achievements = total_ach
            game.cover_url = cover_url

        await db.flush()

        # Upsert UserGame join row
        result2 = await db.execute(
            select(UserGame).where(UserGame.user_id == user.id, UserGame.game_id == game.id)
        )
        user_game = result2.scalar_one_or_none()

        if user_game is None:
            user_game = UserGame(
                user_id=user.id,
                game_id=game.id,
                current_gamerscore=current_gs,
                current_achievements_unlocked=current_ach,
                minutes_played=minutes_played,
                last_played_at=last_played,
                last_synced_at=datetime.now(UTC),
            )
            db.add(user_game)
        else:
            user_game.current_gamerscore = current_gs
            user_game.current_achievements_unlocked = current_ach
            if minutes_played > 0:
                user_game.minutes_played = minutes_played
            user_game.last_played_at = last_played
            user_game.last_synced_at = datetime.now(UTC)

        synced_games.append(game)

    await db.flush()
    return synced_games


async def _fetch_achievements(
    openxbl: OpenXBLClient,
    user: User,
    game: Game,
    sem: asyncio.Semaphore,
) -> tuple[Game, list[dict]]:
    """Fetch (no DB writes) one game's achievements, bounded by a concurrency
    semaphore. Returns (game, raw); [] if that title's fetch fails."""
    async with sem:
        try:
            return game, await openxbl.get_achievements_for_title(user.xuid, game.title_id)
        except OpenXBLRateLimitError:
            raise  # propagate so the whole sync surfaces a 429
        except Exception as exc:
            logger.warning(
                "Skipping achievements for %s (title_id=%s platform=%s): %s",
                game.name, game.title_id, game.platform, exc,
            )
            return game, []


async def _persist_achievements(
    user: User,
    game: Game,
    raw_achievements: list[dict],
    db: AsyncSession,
) -> int:
    """Upsert already-fetched achievements and unlocks for one game. Returns count synced."""
    if not raw_achievements:
        return 0

    synced = 0
    for raw in raw_achievements:
        ach_id = str(raw.get("id", raw.get("achievementId", "")))
        if not ach_id:
            continue

        result = await db.execute(
            select(Achievement).where(
                Achievement.game_id == game.id,
                Achievement.achievement_id == ach_id,
            )
        )
        ach = result.scalar_one_or_none()

        # Gamerscore: modern = rewards array, legacy 360 = direct "gamerscore" field
        rewards = raw.get("rewards") or []
        gs_value = sum(int(r.get("value", 0)) for r in rewards if r.get("type") == "Gamerscore")
        if gs_value == 0:
            gs_value = int(raw.get("gamerscore", raw.get("value", 0)) or 0)

        rarity = raw.get("rarity", {}).get("currentPercentage") if raw.get("rarity") else None
        is_secret = raw.get("isSecret", False)
        desc = raw.get("description") or raw.get("lockedDescription")
        locked_desc = raw.get("lockedDescription")
        icon_url = _extract_icon(raw)
        dlc_name = _extract_dlc_name(raw)

        if ach is None:
            ach = Achievement(
                game_id=game.id,
                achievement_id=ach_id,
                name=raw.get("name", "Unknown"),
                description=desc,
                locked_description=locked_desc,
                gamerscore_value=gs_value,
                rarity_percent=rarity,
                is_secret=is_secret,
                icon_url=icon_url,
                dlc_name=dlc_name,
            )
            db.add(ach)
        else:
            ach.name = raw.get("name", ach.name)
            ach.description = desc
            ach.gamerscore_value = gs_value
            ach.rarity_percent = rarity
            ach.is_secret = is_secret
            ach.icon_url = icon_url
            ach.dlc_name = dlc_name

        await db.flush()

        # Track unlock — modern uses progression.timeUnlocked, legacy 360 uses isEarned + earnedOn
        progression = raw.get("progression", {})
        time_unlocked = progression.get("timeUnlocked") if progression else None
        if not time_unlocked or time_unlocked == "0001-01-01T00:00:00Z":
            # Legacy 360 format: earnedOn / dateEarned / timeUnlocked at top level
            time_unlocked = (
                raw.get("earnedOn")
                or raw.get("dateEarned")
                or raw.get("timeUnlocked")
            )
        is_earned_flag = raw.get("isEarned", False)
        progress_state = raw.get("progressState", "")
        is_unlocked = bool(
            (time_unlocked and time_unlocked != "0001-01-01T00:00:00Z")
            or is_earned_flag
            or progress_state == "Achieved"
        )

        if is_unlocked:
            unlock_result = await db.execute(
                select(Unlock).where(
                    Unlock.user_id == user.id,
                    Unlock.achievement_id == ach.id,
                )
            )
            unlock = unlock_result.scalar_one_or_none()
            parsed_ts = _parse_dt(time_unlocked)
            # Discard bogus epoch-zero dates (year 1) from 360 games
            if parsed_ts and parsed_ts.year < 2000:
                parsed_ts = None
            if unlock is None:
                db.add(
                    Unlock(
                        user_id=user.id,
                        achievement_id=ach.id,
                        unlocked_at=parsed_ts,
                    )
                )

        synced += 1

    # Update game.total_achievements with the real count from the achievements endpoint
    if synced > 0 and game.total_achievements != synced:
        game.total_achievements = synced

    await db.flush()
    return synced


async def full_sync(
    xuid: str,
    openxbl: OpenXBLClient,
    db: AsyncSession,
    sync_achievements: bool = True,
) -> SyncResult:
    """Run a complete sync: profile → games → achievements (optional)."""
    user = await sync_profile(xuid, openxbl, db)
    games = await sync_games(user, openxbl, db)

    total_achievements = 0
    if sync_achievements and games:
        # Fetch every game's achievements concurrently (HTTP round-trips are the
        # bottleneck — this turns a multi-minute sync into seconds), bounded by a
        # semaphore. Then persist sequentially, since one DB session can't be used
        # by concurrent tasks.
        sem = asyncio.Semaphore(SYNC_CONCURRENCY)
        fetched = await asyncio.gather(
            *(_fetch_achievements(openxbl, user, g, sem) for g in games)
        )
        for game, raw_achievements in fetched:
            total_achievements += await _persist_achievements(user, game, raw_achievements, db)

    await db.commit()
    logger.info("Sync complete for %s: %d games, %d achievements", xuid, len(games), total_achievements)

    return SyncResult(
        gamertag=user.gamertag,
        xuid=user.xuid,
        gamerscore=user.gamerscore,
        games_synced=len(games),
        achievements_synced=total_achievements,
    )


# ------------------------------------------------------------------
# Private helpers for normalizing OpenXBL response shapes
# ------------------------------------------------------------------

def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _extract_platform(raw: dict) -> str | None:
    devices = raw.get("devices", [])
    return devices[0] if devices else raw.get("platform")


def _extract_cover(raw: dict) -> str | None:
    images = raw.get("displayImage", raw.get("images", []))
    if isinstance(images, str):
        return images
    if isinstance(images, list) and images:
        first = images[0]
        return first.get("url") if isinstance(first, dict) else first
    return None


def _extract_icon(raw: dict) -> str | None:
    media_assets = raw.get("mediaAssets", [])
    if media_assets:
        return media_assets[0].get("url")
    if raw.get("iconImage"):
        return raw["iconImage"].get("url")
    # Legacy 360 format
    return raw.get("imageUrl") or raw.get("imageUnlocked") or raw.get("imageNotEarned")


def _extract_dlc_name(raw: dict) -> str | None:
    # Xbox Live v2 achievements include a category/subcategory for DLC grouping
    category = raw.get("category") or raw.get("subcategory")
    if category and isinstance(category, str) and category.strip():
        return category.strip()
    # Some API shapes nest it under titleAssociations
    associations = raw.get("titleAssociations", [])
    if associations and isinstance(associations, list):
        name = associations[0].get("name") if associations[0] else None
        if name and name.strip():
            return name.strip()
    return None
