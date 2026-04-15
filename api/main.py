"""Canton Hub API — FastAPI application."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.dependencies import get_cache
from api.routes import price, network, chart, feed, governance, analytics
from api.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    cache = get_cache()
    await start_scheduler(cache)
    yield


app = FastAPI(title="Canton Hub API", lifespan=lifespan)

# CORS — tighten in production via ALLOWED_ORIGINS env var
# Dev: unset → allow all (localhost friendly)
# Prod: set to comma-separated list e.g. "https://canton-hub.vercel.app,https://canton.example.com"
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "").strip()
if _allowed_origins_env:
    _allowed_origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
else:
    _allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(price.router)
app.include_router(network.router)
app.include_router(chart.router)
app.include_router(feed.router)
app.include_router(governance.router)
app.include_router(analytics.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
