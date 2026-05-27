from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    xuid: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    gamertag: Mapped[str] = mapped_column(String(100), nullable=False)
    gamerscore: Mapped[int] = mapped_column(default=0)
    account_tier: Mapped[str | None] = mapped_column(String(50))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    microsoft_sub: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True, index=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
