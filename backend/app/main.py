import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import portfolios, risk

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Risk Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolios.router)
app.include_router(risk.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
