from fastapi import APIRouter

from .aigc_routes import router as aigc_router
from .routes import router as business_router

api_router = APIRouter()
api_router.include_router(business_router)
api_router.include_router(aigc_router)
