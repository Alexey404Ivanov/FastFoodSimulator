import uuid
from datetime import UTC, datetime, timedelta

import jwt

from src.settings.auth.auth_settings import AuthSettings


class AuthProcessor:
    def __init__(
        self,
        settings: AuthSettings,
    ):
        self.settings = settings

    def encode_jwt(
        self,
        payload: dict,
    ) -> str:
        private_key: str = self.settings.private_key_path.read_text()
        algorithm: str = self.settings.algorithm
        expire_minutes: int = self.settings.access_token_expire_minutes

        to_encode = payload.copy()
        now = datetime.now(UTC)

        expire = now + timedelta(minutes=expire_minutes)

        to_encode.update(
            exp=expire,
            iat=now,
            jti=str(uuid.uuid4()),
        )
        encoded = jwt.encode(
            to_encode,
            private_key,
            algorithm=algorithm,
        )
        return encoded

    def decode_jwt(
        self,
        token: str | bytes,
    ) -> dict:
        public_key: str = self.settings.public_key_path.read_text()
        algorithm: str = self.settings.algorithm

        decoded = jwt.decode(
            token,
            public_key,
            algorithms=[algorithm],
        )
        return decoded