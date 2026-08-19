from fastapi import APIRouter

from .routes import router as business_router

api_router = APIRouter()
api_router.include_router(business_router)
