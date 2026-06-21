from fastapi import APIRouter, Depends
from src.schemas.user_schemas import UserCreateSchema, UserResponseSchema
from typing import Annotated
from src.services.user_service import UserService
from src.api.dependencies import get_user_service

router = APIRouter(prefix="/users", tags=["users"])

@router.post(
    "/",
    response_model=UserResponseSchema,
)
async def create_user(
    user: UserCreateSchema,
    user_service: Annotated[UserService, Depends(get_user_service)],
):
    return await user_service.add_user(user)
