from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class APISettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8-sig")

    port: int = Field(validation_alias="API_PORT")
    host: str = Field(validation_alias="API_HOST")
