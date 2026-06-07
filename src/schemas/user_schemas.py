from pydantic import BaseModel

class UserAddSchema(BaseModel):
    username: str
    email: str
    password: str

class UserResponseSchema(BaseModel):
    id: int