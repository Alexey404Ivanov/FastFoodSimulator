import fastapi
from app.api.routes import router as api_router


app = fastapi.FastAPI()

app.include_router(api_router)