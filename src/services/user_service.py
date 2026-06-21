from src.interfaces.repository import AbstractUserRepository
from src.models.user_model import UserModel
from src.schemas.user_schemas import UserCreateSchema, UserResponseSchema
from src.utils.hasher import Hasher

class UserService:
    def __init__(
        self,
        users_repo: AbstractUserRepository,
        hasher: Hasher,
    ):
        self.users_repo = users_repo
        self.hasher = hasher

    async def add_user(self, schema: UserCreateSchema) -> UserResponseSchema:
        hashed_password = self.hasher.hash_password(schema.password).decode("utf-8")

        user_model = UserModel(
            username=schema.username,
            email=schema.email,
            hashed_password=hashed_password,
        )

        user_id = await self.users_repo.add_one(user_model)
        return UserResponseSchema(id=user_id)
