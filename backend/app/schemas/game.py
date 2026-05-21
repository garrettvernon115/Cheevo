from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class GameOut(BaseModel):
    id: int
    title_id: str
    name: str
    platform: str | None
    total_achievements: int
    total_gamerscore: int
    cover_url: str | None

    model_config = {"from_attributes": True}


class AchievementOut(BaseModel):
    id: int
    achievement_id: str
    name: str
    description: str | None
    gamerscore_value: int
    rarity_percent: float | None
    is_secret: bool
    icon_url: str | None

    model_config = {"from_attributes": True}


class UserGameOut(BaseModel):
    game: GameOut
    current_gamerscore: int
    current_achievements_unlocked: int
    completion_percent: float
    last_played_at: datetime | None

    model_config = {"from_attributes": True}
