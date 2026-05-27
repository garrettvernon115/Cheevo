from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.game import Achievement, Game, Unlock, UserGame
from app.models.user import User
from app.schemas.game import AchievementOut, UserGameDetailOut, UserGameOut

router = APIRouter(prefix="/games", tags=["games"])


async def _get_user(db: AsyncSession, xuid: str) -> User:
    result = await db.execute(select(User).where(User.xuid == xuid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Profile not found — run sync first")
    return user


async def _get_game(db: AsyncSession, title_id: str) -> Game:
    result = await db.execute(select(Game).where(Game.title_id == title_id))
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


def _completion(unlocked: int, total_ach: int, gs: int, total_gs: int) -> float:
    if total_ach > 0:
        return round(unlocked / total_ach * 100, 1)
    if total_gs > 0:
        return round(gs / total_gs * 100, 1)
    return 0.0


@router.get("/", response_model=list[UserGameOut])
async def list_my_games(
    db: AsyncSession = Depends(get_db),
    x_user_xuid: str = Header(...),
):
    user = await _get_user(db, x_user_xuid)
    result = await db.execute(
        select(UserGame)
        .where(UserGame.user_id == user.id)
        .options(selectinload(UserGame.game))
        .order_by(UserGame.last_played_at.desc().nullslast())
    )
    user_games = result.scalars().all()

    return [
        UserGameOut(
            game=ug.game,
            current_gamerscore=ug.current_gamerscore,
            current_achievements_unlocked=ug.current_achievements_unlocked,
            completion_percent=_completion(
                ug.current_achievements_unlocked,
                ug.game.total_achievements,
                ug.current_gamerscore,
                ug.game.total_gamerscore,
            ),
            last_played_at=ug.last_played_at,
        )
        for ug in user_games
    ]


@router.get("/{title_id}", response_model=UserGameDetailOut)
async def get_game_detail(
    title_id: str,
    db: AsyncSession = Depends(get_db),
    x_user_xuid: str = Header(...),
):
    user = await _get_user(db, x_user_xuid)
    game = await _get_game(db, title_id)

    result = await db.execute(
        select(UserGame).where(
            UserGame.user_id == user.id,
            UserGame.game_id == game.id,
        )
    )
    ug = result.scalar_one_or_none()

    current_gs = ug.current_gamerscore if ug else 0
    current_ach = ug.current_achievements_unlocked if ug else 0
    minutes = ug.minutes_played if ug else 0
    last_played = ug.last_played_at if ug else None

    return UserGameDetailOut(
        game=game,
        current_gamerscore=current_gs,
        current_achievements_unlocked=current_ach,
        completion_percent=_completion(current_ach, game.total_achievements, current_gs, game.total_gamerscore),
        minutes_played=minutes,
        last_played_at=last_played,
    )


@router.get("/{title_id}/achievements", response_model=list[AchievementOut])
async def list_achievements(
    title_id: str,
    filter: Literal["all", "earned", "locked"] = Query(default="all"),
    db: AsyncSession = Depends(get_db),
    x_user_xuid: str = Header(...),
):
    user = await _get_user(db, x_user_xuid)
    game = await _get_game(db, title_id)

    rows = await db.execute(
        select(Achievement, Unlock)
        .outerjoin(
            Unlock,
            (Unlock.achievement_id == Achievement.id) & (Unlock.user_id == user.id),
        )
        .where(Achievement.game_id == game.id)
        .order_by(Unlock.unlocked_at.desc().nullslast(), Achievement.gamerscore_value.desc())
    )

    out: list[AchievementOut] = []
    for ach, unlock in rows.all():
        is_earned = unlock is not None
        if filter == "earned" and not is_earned:
            continue
        if filter == "locked" and is_earned:
            continue
        out.append(
            AchievementOut(
                id=ach.id,
                achievement_id=ach.achievement_id,
                name=ach.name,
                description=ach.description,
                locked_description=ach.locked_description,
                gamerscore_value=ach.gamerscore_value,
                rarity_percent=ach.rarity_percent,
                is_secret=ach.is_secret,
                icon_url=ach.icon_url,
                dlc_name=ach.dlc_name,
                earned=is_earned,
                earned_at=unlock.unlocked_at if unlock else None,
            )
        )
    return out


