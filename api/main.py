"""Canton Hub API — FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import price, network, chart, feed, governance

app = FastAPI(title="Canton Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(price.router)
app.include_router(network.router)
app.include_router(chart.router)
app.include_router(feed.router)
app.include_router(governance.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
