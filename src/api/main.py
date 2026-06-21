# from fastapi import FastAPI
# from fastapi.staticfiles import StaticFiles
#
# from api.routes.simulations import router as api_router

# @asynccontextmanager
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

# app = FastAPI(lifespan=lifespan)
