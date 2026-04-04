import logging

import uvicorn

from app.settings.api_settings import APISettings

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    api_settings = APISettings()
    uvicorn.run("app.api.main:app", reload=True, host=api_settings.host, port=api_settings.port)

