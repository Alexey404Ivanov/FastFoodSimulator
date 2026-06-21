from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

SRC_DIR = Path(__file__).parent.parent

class AuthSettings(BaseModel):
    private_key_path: Path = SRC_DIR / "certs" / "jwt-private.pem"
    public_key_path: Path = SRC_DIR / "certs" / "jwt-public.pem"
    algorithm: str = "RS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    # refresh_token_expire_minutes: int = 60 * 24 * 30
    # access_token_expire_minutes: int = 3


@lru_cache
def get_auth_settings() -> AuthSettings:
    return AuthSettings()