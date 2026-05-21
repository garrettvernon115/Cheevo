from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    xuid: str
    gamertag: str
    gamerscore: int
    account_tier: str | None
    avatar_url: str | None
    last_synced_at: datetime | None

    model_config = {"from_attributes": True}


class SyncResult(BaseModel):
    gamertag: str
    xuid: str
    gamerscore: int
    games_synced: int
    achievements_synced: int
