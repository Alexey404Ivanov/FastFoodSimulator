from src.interfaces.repository import AbstractUserRepository
from src.models.user_model import UserModel
from src.utils.jwt_processor import AuthProcessor


class AuthService:
    def __init__(
        self,
        user_repo: AbstractUserRepository,
        auth_processor: AuthProcessor,
    ):
        self.user_repo = user_repo
        self.auth_processor = auth_processor

    async def authenticate_user(self, username: str, password: str) -> UserModel:
        user: UserModel | None = await self.user_repo.get_by_username(username)

        if not user:
            raise InvalidCredentialsError

        if not self.hasher.verify(password, user.hashed_password):
            raise InvalidCredentialsError

        if not user.is_active:
            raise UserInactiveError

        return user