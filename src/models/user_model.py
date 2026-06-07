from sqlalchemy.orm import Mapped, mapped_column

from src.models.base_model import Base

class UserModel(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str]
    email: Mapped[str]
    password: Mapped[str]
