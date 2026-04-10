"""Canton Hub API — FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import price

app = FastAPI(title="Canton Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(price.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
