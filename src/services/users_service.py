from src.interfaces.repository import AbstractUserRepository
from src.models.user_model import UserModel
from src.schemas.user_schemas import UserAddSchema, UserResponseSchema


class UsersService:
    def __init__(self, users_repo: AbstractUserRepository):
        self.users_repo = users_repo

    async def add_user(self, user: UserAddSchema) -> UserResponseSchema:
        user_model = UserModel(**user.model_dump())
        user_id = await self.users_repo.add_one(user_model)
        return UserResponseSchema(id=user_id)
