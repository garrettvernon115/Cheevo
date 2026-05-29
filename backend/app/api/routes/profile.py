from __future__ import annotations

import logging
import traceback

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User
from app.schemas.user import SyncResult, UserOut
from app.services.openxbl import OpenXBLClient, OpenXBLRateLimitError, get_openxbl_client
from app.services.sync import full_sync
from app.services.sync_jobs import get_status, mark_running, run_background_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])


class SetupRequest(BaseModel):
    microsoft_sub: str
    gamertag: str


@router.get("/by-sub/{microsoft_sub}")
async def get_xuid_by_sub(microsoft_sub: str, db: AsyncSession = Depends(get_db)):
    """Look up a user's XUID by their Microsoft account ID."""
    result = await db.execute(select(User).where(User.microsoft_sub == microsoft_sub))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="No Xbox account linked")
    return {"xuid": user.xuid}


@router.post("/setup")
async def setup_account(
    body: SetupRequest,
    db: AsyncSession = Depends(get_db),
    openxbl: OpenXBLClient = Depends(get_openxbl_client),
):
    """Link a Microsoft account to an Xbox gamertag. Resolves XUID via OpenXBL, then syncs."""
    try:
        xuid = await openxbl.get_xuid_by_gamertag(body.gamertag)
    except OpenXBLRateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Xbox is rate-limiting requests right now. Please wait a few minutes and try linking again.",
        )
    except Exception as exc:
        logger.error("Gamertag lookup failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Could not find Xbox account for gamertag '{body.gamertag}': {exc}")

    # Check if XUID already has a user record
    result = await db.execute(select(User).where(User.xuid == xuid))
    existing = result.scalar_one_or_none()

    if existing:
        existing.microsoft_sub = body.microsoft_sub
        await db.commit()
        return {"xuid": existing.xuid}

    # New user — sync from Xbox first, then link
    try:
        await full_sync(xuid=xuid, openxbl=openxbl, db=db, sync_achievements=False)
    except OpenXBLRateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Xbox is rate-limiting requests right now. Please wait a few minutes and try linking again.",
        )
    except Exception as exc:
        logger.error("Setup sync failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Could not verify Xbox account: {exc}")

    result2 = await db.execute(select(User).where(User.xuid == xuid))
    user = result2.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=400, detail="Failed to create user record")

    user.microsoft_sub = body.microsoft_sub
    await db.commit()
    return {"xuid": user.xuid}


@router.get("/me", response_model=UserOut)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    x_user_xuid: str = Header(...),
):
    result = await db.execute(select(User).where(User.xuid == x_user_xuid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Profile not found — run sync first")
    return user



@router.post("/sync", response_model=SyncResult)
async def sync_my_profile(
    achievements: bool = True,
    db: AsyncSession = Depends(get_db),
    openxbl: OpenXBLClient = Depends(get_openxbl_client),
    x_user_xuid: str = Header(...),
):
    try:
        return await full_sync(
            xuid=x_user_xuid,
            openxbl=openxbl,
            db=db,
            sync_achievements=achievements,
        )
    except OpenXBLRateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Xbox sync is rate-limited right now. Your data is unchanged — please wait a few minutes and try again.",
        )
    except Exception as exc:
        logger.error("Sync failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/sync/start")
async def start_sync(
    background_tasks: BackgroundTasks,
    x_user_xuid: str = Header(...),
):
    """Kick off a full sync in the background and return immediately. The client
    polls /sync/status for progress."""
    await mark_running(x_user_xuid)
    background_tasks.add_task(run_background_sync, x_user_xuid)
    return {"status": "running"}


@router.get("/sync/status")
async def sync_status(x_user_xuid: str = Header(...)):
    """Return the current background-sync progress for this user."""
    status = await get_status(x_user_xuid)
    return status or {"status": "idle"}
