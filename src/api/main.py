from contextlib import asynccontextmanager, contextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.api.dependencies import publisher
from src.api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await publisher.connect()
    yield
    await publisher.close()

app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="src/static"), name="static")

app.include_router(api_router)