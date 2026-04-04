from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def index():
    return {"message": "Алексей ИВАНОВ БЛЯ — Гниль позорная"}