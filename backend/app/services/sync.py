from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Achievement, Game, Unlock, UserGame
from app.models.user import User
from app.schemas.user import SyncResult
from app.services.openxbl import OpenXBLClient

logger = logging.getLogger(__name__)


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

    gamertag = settings_map.get("Gamertag", profile.get("displayName", "Unknown"))
    gamerscore = int(settings_map.get("Gamerscore", 0))
    account_tier = settings_map.get("AccountTier")
    avatar_url = settings_map.get("GameDisplayPicRaw")

    result = await db.execute(select(User).where(User.xuid == xuid))
    user = result.scalar_one_or_none()
    now = datetime.now(UTC)

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

        # Last played comes from titleHistory.lastTimePlayed
        title_history = raw.get("titleHistory", {}) or {}
        last_played = _parse_dt(title_history.get("lastTimePlayed"))

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
                last_played_at=last_played,
                last_synced_at=datetime.now(UTC),
            )
            db.add(user_game)
        else:
            user_game.current_gamerscore = current_gs
            user_game.current_achievements_unlocked = current_ach
            user_game.last_played_at = last_played
            user_game.last_synced_at = datetime.now(UTC)

        synced_games.append(game)

    await db.flush()
    return synced_games


async def sync_achievements_for_game(
    user: User,
    game: Game,
    openxbl: OpenXBLClient,
    db: AsyncSession,
) -> int:
    """Upsert achievements and unlocks for one game. Returns count synced."""
    try:
        raw_achievements = await openxbl.get_achievements_for_title(user.xuid, game.title_id)
    except Exception as exc:
        logger.warning("Skipping achievements for %s: %s", game.name, exc)
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

        rewards = raw.get("rewards", [{}])
        gs_value = sum(int(r.get("value", 0)) for r in rewards if r.get("type") == "Gamerscore")
        rarity = raw.get("rarity", {}).get("currentPercentage") if raw.get("rarity") else None
        is_secret = raw.get("isSecret", False)
        desc = raw.get("description") or raw.get("lockedDescription")
        locked_desc = raw.get("lockedDescription")
        icon_url = _extract_icon(raw)

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
            )
            db.add(ach)
        else:
            ach.name = raw.get("name", ach.name)
            ach.description = desc
            ach.gamerscore_value = gs_value
            ach.rarity_percent = rarity
            ach.is_secret = is_secret
            ach.icon_url = icon_url

        await db.flush()

        # Track unlock if the achievement is earned
        progression = raw.get("progression", {})
        time_unlocked = progression.get("timeUnlocked") if progression else None
        is_unlocked = bool(time_unlocked and time_unlocked != "0001-01-01T00:00:00Z")

        if is_unlocked:
            unlock_result = await db.execute(
                select(Unlock).where(
                    Unlock.user_id == user.id,
                    Unlock.achievement_id == ach.id,
                )
            )
            unlock = unlock_result.scalar_one_or_none()
            if unlock is None:
                db.add(
                    Unlock(
                        user_id=user.id,
                        achievement_id=ach.id,
                        unlocked_at=_parse_dt(time_unlocked),
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
    if sync_achievements:
        for game in games:
            count = await sync_achievements_for_game(user, game, openxbl, db)
            total_achievements += count

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
    return raw.get("iconImage", {}).get("url") if raw.get("iconImage") else None
