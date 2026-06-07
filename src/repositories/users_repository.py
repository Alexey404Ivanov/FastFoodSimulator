from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.interfaces.repository import AbstractUserRepository
from src.schemas.user_schemas import UserAddSchema
from src.models.user_model import UserModel


class SqlAlchemyUserRepository(AbstractUserRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add_one(self, user: UserModel) -> int:
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user.id



