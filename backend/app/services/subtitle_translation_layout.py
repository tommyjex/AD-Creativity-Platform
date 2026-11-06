"""Compatibility module sharing the original compiler's globals and font cache."""

import sys

from video_subtitle_grounding import layout

sys.modules[__name__] = layout
