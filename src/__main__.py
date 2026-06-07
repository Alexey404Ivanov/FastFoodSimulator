import logging

import uvicorn

from src.config.project_config import get_settings

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    settings = get_settings()
    uvicorn.run("src.api.main:app", reload=False, host=settings.API_HOST, port=settings.API_PORT)

