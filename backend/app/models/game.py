from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(primary_key=True)
    title_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    platform: Mapped[str | None] = mapped_column(String(50))
    total_achievements: Mapped[int] = mapped_column(default=0)
    total_gamerscore: Mapped[int] = mapped_column(default=0)
    cover_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    achievements: Mapped[list[Achievement]] = relationship("Achievement", back_populates="game")
    user_games: Mapped[list[UserGame]] = relationship("UserGame", back_populates="game")


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), nullable=False, index=True)
    # Xbox achievement identifier within a title
    achievement_id: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    locked_description: Mapped[str | None] = mapped_column(String(1000))
    gamerscore_value: Mapped[int] = mapped_column(default=0)
    rarity_percent: Mapped[float | None]
    is_secret: Mapped[bool] = mapped_column(default=False)
    icon_url: Mapped[str | None] = mapped_column(String(500))
    dlc_name: Mapped[str | None] = mapped_column(String(300))

    game: Mapped[Game] = relationship("Game", back_populates="achievements")
    unlocks: Mapped[list[Unlock]] = relationship("Unlock", back_populates="achievement")

    __table_args__ = (UniqueConstraint("game_id", "achievement_id", name="uq_achievement_per_game"),)


class UserGame(Base):
    __tablename__ = "user_games"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), nullable=False, index=True)
    current_gamerscore: Mapped[int] = mapped_column(default=0)
    current_achievements_unlocked: Mapped[int] = mapped_column(default=0)
    minutes_played: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship("User")
    game: Mapped[Game] = relationship("Game", back_populates="user_games")

    __table_args__ = (UniqueConstraint("user_id", "game_id", name="uq_user_game"),)


class Unlock(Base):
    __tablename__ = "unlocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    achievement_id: Mapped[int] = mapped_column(ForeignKey("achievements.id"), nullable=False, index=True)
    unlocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship("User")
    achievement: Mapped[Achievement] = relationship("Achievement", back_populates="unlocks")

    __table_args__ = (UniqueConstraint("user_id", "achievement_id", name="uq_unlock"),)
