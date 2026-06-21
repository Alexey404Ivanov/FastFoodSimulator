from fastapi import APIRouter

from src.api.routes.auth import router as auth_router
from src.api.routes.simulations import router as simulations_router
from src.api.routes.users import router as users_router

router = APIRouter(prefix="/api")

router.include_router(auth_router)
router.include_router(simulations_router)
router.include_router(users_router)
