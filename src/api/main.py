from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from os import getenv

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.api.dependencies import publisher
from src.api.routes import router as api_router
from src.infrastructure.redis.provider import RedisProvider


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await publisher.connect()
    await RedisProvider.init(getenv("REDIS_URL", "redis://localhost:6379/0"))
    try:
        yield
    finally:
        await publisher.close()
        await RedisProvider.close()


app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="src/static"), name="static")
app.include_router(api_router)
