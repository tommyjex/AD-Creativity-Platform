"""Conservative brand exclusions shared by extraction and workspace stages."""

from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
import unicodedata

BRAND_RULE_VERSION = "tineco-brand-20261117-v1"
BRAND_SKIPPED_WARNING = "brand_content_skipped"


def _get(record, key):
    return record.get(key) if isinstance(record, Mapping) else getattr(record, key, None)


def _slogan_text(text):
    if not isinstance(text, str):
        return ""
    return " ".join(unicodedata.normalize("NFKC", text).casefold().replace(".", "").split())


@dataclass(frozen=True)
class BrandFilterResult:
    kept: tuple
    skipped_indexes: frozenset[int]
    counts: dict[str, int]


def filter_brand_records(records):
    """Keep original objects, recognizing only complete and reliable brand text.

    Split slogans require a common positive-duration intersection, consecutive
    unique line indexes and a real visual block. No text or timing is rewritten.
    """
    records = tuple(records)
    skipped = set()
    counts = Counter()
    groups = {}
    for index, record in enumerate(records):
        text = _get(record, "text")
        if isinstance(text, str) and text.strip().casefold() == "tineco":
            skipped.add(index)
            counts["logo"] += 1
        elif _slogan_text(text) == "live easy enjoy life":
            skipped.add(index)
            counts["slogan"] += 1
        block = _get(record, "block_id")
        line = _get(record, "line_index")
        start, end = _get(record, "start_ms"), _get(record, "end_ms")
        if (isinstance(block, str) and block and not block.casefold().startswith("legacy")
                and type(line) is int and line >= 0
                and type(start) is int and type(end) is int and start < end):
            groups.setdefault(block, []).append((line, index, start, end))
    for group in groups.values():
        group.sort()
        for first in group:
            low, high = first[2], first[3]
            indexes, words = [], []
            current = first
            while current:
                line, index, start, end = current
                if index in skipped:
                    break
                # Ambiguous repeated line numbers cannot establish a visual line.
                if sum(other[0] == line and max(start, other[2]) < min(end, other[3])
                       for other in group) != 1:
                    break
                low, high = max(low, start), min(high, end)
                if low >= high:
                    break
                indexes.append(index)
                words.append(_slogan_text(_get(records[index], "text")))
                text = " ".join(words)
                if len(indexes) > 1 and text == "live easy enjoy life":
                    skipped.update(indexes)
                    counts["multiline_slogan"] += len(indexes)
                    break
                if not "live easy enjoy life".startswith(text) or not words[-1]:
                    break
                candidates = [other for other in group if other[0] == line + 1
                              and max(low, other[2]) < min(high, other[3])]
                if len(candidates) != 1:
                    break
                current = candidates[0]
    return BrandFilterResult(
        tuple(record for index, record in enumerate(records) if index not in skipped),
        frozenset(skipped), dict(counts),
    )
