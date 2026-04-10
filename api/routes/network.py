# api/routes/network.py
"""Network KPI and status endpoints."""
from fastapi import APIRouter, Depends
from api.cache import TTLCache
from api.dependencies import get_cache

router = APIRouter(prefix="/api")

_EMPTY_NETWORK = {
    "bm_ratio": None, "bm_status": None,
    "active_addresses_24h": None, "active_addresses_change": None,
    "daily_burn_usd": None, "daily_burn_change": None,
    "private_tx_ratio": None, "private_tx_count": None,
    "daily_mint": None, "daily_burn": None, "net_supply_change": None,
}

_EMPTY_STATUS = {
    "total_supply": None, "super_validators": None, "validator_nodes": None,
    "total_transfers_24h": None, "cumulative_burned": None, "cumulative_burn_rate": None,
}


@router.get("/network")
async def get_network(cache: TTLCache = Depends(get_cache)):
    return cache.get("network") or _EMPTY_NETWORK


@router.get("/network/status")
async def get_network_status(cache: TTLCache = Depends(get_cache)):
    return cache.get("network_status") or _EMPTY_STATUS
