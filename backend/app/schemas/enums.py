from enum import Enum


class Status(str, Enum):
    DRAFT = "draft"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    SKIPPED = "skipped"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    STALE = "stale"


class Stage(str, Enum):
    BRIEF = "brief"
    STORY = "story"
    CHARACTER = "character"
    SCRIPT = "script"
    STORYBOARD = "storyboard"
    IMAGE = "image"
    VIDEO = "video"
    COMPOSE = "compose"


class TargetLanguage(str, Enum):
    ZH = "zh"
    EN = "en"


class ProjectType(str, Enum):
    VIDEO_AD = "video_ad"
    IMAGE_ASSET = "image_asset"


class ImagePurpose(str, Enum):
    ECOMMERCE_MAIN = "ecommerce_main"
    POSTER = "poster"


class AssetType(str, Enum):
    UPLOADED_IMAGE = "uploaded_image"
    UPLOADED_VIDEO = "uploaded_video"
    UPLOADED_AUDIO = "uploaded_audio"
    GENERATED_IMAGE = "generated_image"
    STORYBOARD_VIDEO = "storyboard_video"
    FINAL_VIDEO = "final_video"
    SUBTITLE = "subtitle"


class AssetCategory(str, Enum):
    CHARACTER = "character"
    SCENE = "scene"
    REFERENCE = "reference"


class AssetRole(str, Enum):
    PUBLIC = "public"
    INTERNAL_BASE = "internal_base"
    INTERNAL_LAYER = "internal_layer"


class ToolTaskType(str, Enum):
    FACE_BLUR_VIDEO = "face_blur_video"
    MULTIMODAL_VIDEO_GENERATION = "multimodal_video_generation"


class ToolAssetRole(str, Enum):
    INPUT = "input"
    OUTPUT = "output"


class ImageGenerationOperation(str, Enum):
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_TO_IMAGE = "image_to_image"


class ImageGenerationSize(str, Enum):
    ONE_K = "1K"
    ONE_POINT_FIVE_K = "1.5K"
    TWO_K = "2K"


class ImageLayerDecompositionSize(str, Enum):
    AUTO = "auto"
    ONE_K = "1K"
    ONE_POINT_FIVE_K = "1.5K"
    TWO_K = "2K"


class ImageOutputFormat(str, Enum):
    PNG = "png"
    JPEG = "jpeg"


class ReferenceAssetKind(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class CharacterAssetIterationOperation(str, Enum):
    EDIT = "edit"
    REGENERATE = "regenerate"


class ErrorCode(str, Enum):
    VALIDATION_ERROR = "validation_error"
    NOT_FOUND = "not_found"
    DEPENDENCY_MISSING = "dependency_missing"
    TASK_CONFLICT = "task_conflict"
    INVALID_STATE = "invalid_state"
    GENERATION_FAILED = "generation_failed"
    EXTERNAL_SERVICE_ERROR = "external_service_error"
    UNKNOWN = "unknown"
