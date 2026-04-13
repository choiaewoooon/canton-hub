"""Canton Hub API — FastAPI application."""
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

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(price.router)
app.include_router(network.router)
app.include_router(chart.router)
app.include_router(feed.router)
app.include_router(governance.router)
app.include_router(analytics.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
