import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from src.api import router as api_router
from src.settings.api_settings import get_settings
from src.views import router as views_router

# async def lifespan(app: FastAPI):
#     await publisher.connect()
#     await RedisProvider.init("redis://localhost:6379/0")
#     await SimulationStateLifecycle.initialize(simulation_id=1488)
#
#     try:
#         yield
#     finally:
#         try:
#             await shield(SimulationStateLifecycle.cleanup(simulation_id=1488))
#         except Exception as e:
#             print(f"Cleanup error: {e}")
#
#         await publisher.close()
#         await RedisProvider.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="src/static"), name="static")
app.include_router(api_router)
app.include_router(views_router)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    settings = get_settings()
    uvicorn.run(
        app="src.__main__:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,
    )

