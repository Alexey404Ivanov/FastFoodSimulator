from typing import Annotated

from annotated_types import MaxLen, MinLen
from pydantic import BaseModel, EmailStr


class UserCreateSchema(BaseModel):
    username: Annotated[str, MinLen(3), MaxLen(20)]
    email: EmailStr
    password: str

class UserLoginSchema(BaseModel):
    username: Annotated[str, MinLen(3), MaxLen(20)]
    password: str

class UserResponseSchema(BaseModel):
    id: int