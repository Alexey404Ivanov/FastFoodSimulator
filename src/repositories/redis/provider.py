import redis.asyncio as redis


class RedisProvider:
    _client: redis.Redis | None = None

    @classmethod
    async def init(cls, url: str):
        if cls._client is None:
            cls._client = redis.from_url(
                url,
                decode_responses=True,
            )
        await cls._client.ping()

    @classmethod
    def get_client(cls) -> redis.Redis:
        if cls._client is None:
            raise RuntimeError("RedisProvider is not initialized")
        return cls._client

    @classmethod
    async def close(cls):
        if cls._client:
            await cls._client.aclose()
            cls._client = None
