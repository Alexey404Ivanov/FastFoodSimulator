from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.publisher import ApiPublisher
from src.settings.db.db_helper import db_helper
from src.repositories.postgres.user_repository import SqlAlchemyUserRepository
from src.services.user_service import UserService
from src.utils.hasher import Hasher

publisher = ApiPublisher()

async def get_db_session():
    async with db_helper.get_db_session() as session:
        yield session

SessionDep = Annotated[AsyncSession, Depends(get_db_session)]

def get_user_repository(
    session: SessionDep,
):
    return SqlAlchemyUserRepository(session)

def get_hasher():
    return Hasher()

RepoDep = Annotated[SqlAlchemyUserRepository, Depends(get_user_repository)]
HasherDep = Annotated[Hasher, Depends(get_hasher)]

def get_user_service(
    repo: RepoDep,
    hasher: HasherDep,
):
    return UserService(repo, hasher)