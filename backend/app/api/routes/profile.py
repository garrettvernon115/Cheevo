from __future__ import annotations

import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.user import User
from app.schemas.user import SyncResult, UserOut
from app.services.openxbl import OpenXBLClient, get_openxbl_client
from app.services.sync import full_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=UserOut)
async def get_my_profile(db: AsyncSession = Depends(get_db)):
    """Return the stored profile for the configured XUID."""
    result = await db.execute(select(User).where(User.xuid == settings.my_xuid))
    user = result.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Profile not found — run /sync first")
    return user


@router.post("/sync", response_model=SyncResult)
async def sync_my_profile(
    achievements: bool = True,
    db: AsyncSession = Depends(get_db),
    openxbl: OpenXBLClient = Depends(get_openxbl_client),
):
    """Pull the latest data from OpenXBL and store it."""
    try:
        return await full_sync(
            xuid=settings.my_xuid,
            openxbl=openxbl,
            db=db,
            sync_achievements=achievements,
        )
    except Exception as exc:
        logger.error("Sync failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc))
