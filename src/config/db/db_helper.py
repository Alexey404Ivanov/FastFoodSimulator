from asyncio import current_task
from contextlib import asynccontextmanager

from pydantic import PostgresDsn
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
    async_scoped_session
)

from src.config.db.db_config import get_postgres_config


class DatabaseHelper:
    def __init__(self, url: str):
        self.engine = create_async_engine(url)

        self.session_factory = async_sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False
        )

    @asynccontextmanager
    async def get_db_session(self):
        from sqlalchemy import exc

        session: AsyncSession = self.session_factory()
        try:
            yield session
        except exc.SQLAlchemyError as error:
            await session.rollback()
            raise
        finally:
            await session.close()

db_helper = DatabaseHelper(get_postgres_config().database_url)

