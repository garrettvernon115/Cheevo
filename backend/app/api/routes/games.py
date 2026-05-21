from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import get_db
from app.models.game import Achievement, UserGame
from app.models.user import User
from app.schemas.game import AchievementOut, UserGameOut

router = APIRouter(prefix="/games", tags=["games"])


async def _get_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.xuid == settings.my_xuid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Profile not found — run /profile/sync first")
    return user


@router.get("/", response_model=list[UserGameOut])
async def list_my_games(db: AsyncSession = Depends(get_db)):
    """Return all games with per-user progress."""
    user = await _get_user(db)
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
            completion_percent=(
                round(ug.current_achievements_unlocked / ug.game.total_achievements * 100, 1)
                if ug.game.total_achievements > 0
                else round(ug.current_gamerscore / ug.game.total_gamerscore * 100, 1)
                if ug.game.total_gamerscore > 0
                else 0.0
            ),
            last_played_at=ug.last_played_at,
        )
        for ug in user_games
    ]


@router.get("/{title_id}/achievements", response_model=list[AchievementOut])
async def list_achievements(title_id: str, db: AsyncSession = Depends(get_db)):
    """Return all achievements for a game by its Xbox title_id."""
    from app.models.game import Game

    result = await db.execute(select(Game).where(Game.title_id == title_id))
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    result2 = await db.execute(
        select(Achievement).where(Achievement.game_id == game.id)
    )
    return result2.scalars().all()
