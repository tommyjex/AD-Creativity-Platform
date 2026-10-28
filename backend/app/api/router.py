from fastapi import APIRouter

from .aigc_routes import router as aigc_router
from .auth_routes import router as auth_router
from .experiment_routes import router as experiment_router
from .routes import router as business_router
from .subtitle_translation_routes import router as subtitle_translation_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(experiment_router)
api_router.include_router(business_router)
api_router.include_router(aigc_router)
api_router.include_router(subtitle_translation_router)
