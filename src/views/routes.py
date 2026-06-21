from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="src/templates")

router = APIRouter()

@router.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="home.html")

@router.get("/simulation/1488")
async def get_page(request: Request):
    return templates.TemplateResponse(request=request, name="simulation_1488.html")