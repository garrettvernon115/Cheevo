from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://cheevo:cheevo@localhost:5432/cheevo"

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg_driver(cls, v: str) -> str:
        # Managed Postgres hosts (Railway, Render, Neon, …) hand out
        # postgres:// or postgresql:// URLs, but SQLAlchemy's async engine needs
        # the asyncpg driver scheme. Normalize it so any provider URL works.
        for prefix in ("postgresql://", "postgres://"):
            if v.startswith(prefix):
                return "postgresql+asyncpg://" + v[len(prefix):]
        return v

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # OpenXBL
    openxbl_api_key: str = ""  # legacy shared dev key (demo mode only)
    openxbl_base_url: str = "https://xbl.io/api/v2"
    openxbl_public_key: str = ""  # app Public Key for the per-user OAuth flow
    openxbl_auth_base_url: str = "https://xbl.io"  # /app/auth and /app/claim live here

    # Encryption key (Fernet) for per-user OpenXBL tokens at rest. Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    token_encryption_key: str = ""

    # Xbox user (single-user Phase 1 — replace with auth later)
    my_xuid: str = ""

    # Anthropic
    anthropic_api_key: str = ""

    # Cache TTLs (seconds)
    cache_ttl_profile: int = 300       # 5 min
    cache_ttl_games: int = 3600        # 1 hour
    cache_ttl_achievements: int = 3600 # 1 hour

    # App
    debug: bool = False


settings = Settings()
