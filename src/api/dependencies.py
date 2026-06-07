from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.publisher import ApiPublisher
from src.config.db.db_helper import db_helper
from src.repositories.users_repository import SqlAlchemyUserRepository
from src.services.users_service import UsersService

publisher = ApiPublisher()

# def users_service():
#     return UsersService(UsersRepository)

async def get_db_session():
    async with db_helper.get_db_session() as session:
        yield session

def get_user_repository(
    session: AsyncSession = Depends(get_db_session),
):
    return SqlAlchemyUserRepository(session)


def get_user_service(
    repo: SqlAlchemyUserRepository = Depends(get_user_repository),
):
    return UsersService(repo)