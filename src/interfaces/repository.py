from abc import ABC, abstractmethod

from src.models.user_model import UserModel


class AbstractUserRepository(ABC):
    @abstractmethod
    async def add_one(self, user: UserModel) -> int:
        pass

    # @abstractmethod
    # async def find_one():
    #     pass


