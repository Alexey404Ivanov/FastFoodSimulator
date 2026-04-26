from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.api.dependencies import publisher
from src.api.routes import router as api_router
from src.infrastructure.redis.lifecycle import SimulationStateLifecycle
from src.infrastructure.redis.provider import RedisProvider


@asynccontextmanager
async def lifespan(app: FastAPI):
    await publisher.connect()
    await RedisProvider.init("redis://localhost:6379/0")
    await SimulationStateLifecycle.initialize(simulation_id=1488)

    yield

    await publisher.close()
    await SimulationStateLifecycle.cleanup(simulation_id=1488)
    await RedisProvider.close()

app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="src/static"), name="static")
app.include_router(api_router)