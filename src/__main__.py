import logging

import uvicorn

from src.settings.api_settings import APISettings

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    api_settings = APISettings()
    uvicorn.run("src.api.main:app", reload=False, host=api_settings.host, port=api_settings.port)

