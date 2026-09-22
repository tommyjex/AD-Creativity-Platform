from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def load_seedream_image_prompt() -> str:
    value = (
        Path(__file__)
        .with_name("seedream_image_prompt_optimizer.md")
        .read_text(encoding="utf-8")
    )
    if not value.strip():
        raise RuntimeError("Seedream image prompt resource is empty")
    return value
