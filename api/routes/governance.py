# api/routes/governance.py
"""Governance endpoint — CIP summaries."""
from fastapi import APIRouter, Depends
from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api")


@router.get("/governance")
async def get_governance(cache: TTLCache = Depends(get_cache)):
    data = cache.get("governance")
    if data is None:
        return {"active_proposals": 0, "recent_cips": []}
    return data
