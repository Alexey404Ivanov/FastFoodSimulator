from typing import Annotated

from fastapi import APIRouter, Depends

from services.auth_service import AuthService
from src.api.dependencies import get_user_service
from src.schemas.user_schemas import UserCreateSchema, UserLoginSchema, UserResponseSchema
from src.schemas.token_info import TokenInfo
from src.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])

UserServiceDep = Annotated[UserService, Depends(get_user_service)]
AuthServiceDep = Annotated[AuthService, Depends(get_user_service)] #!!!

@router.post("/register", response_model=UserResponseSchema)
async def register(
    user: UserCreateSchema,
    user_service: UserServiceDep,
):
    return await user_service.add_user(user)


@router.post("/login", response_model=UserResponseSchema)
async def login(
    user: UserLoginSchema,
    auth_service: AuthServiceDep,
):
    try:
        user = await auth_service.authenticate_user(user)