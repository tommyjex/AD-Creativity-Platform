from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable

logger = logging.getLogger(__name__)


class BackgroundTaskRunner:
    """Schedules short-lived in-process background coroutines."""

    def schedule(self, coroutine: Awaitable[None]) -> None:
        task = asyncio.create_task(coroutine)
        task.add_done_callback(self._log_unhandled_exception)

    @staticmethod
    def _log_unhandled_exception(task: asyncio.Task[None]) -> None:
        try:
            task.result()
        except asyncio.CancelledError:
            logger.warning("background task was cancelled")
        except Exception:
            logger.exception("background task failed with an unhandled exception")
