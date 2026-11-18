"""Versioned PDF naming patterns and code point spans, independent of the platform."""

from __future__ import annotations

import hashlib
import re
from uuid import uuid4

CATALOG_VERSION = "tineco-names-20261116-v1"
_GROUPS = [
    (1, "iFLOOR 3", ["", "Breeze Complete"]),
    (1, "iFLOOR Y2", [""]), (1, "iFLOOR Y5", [""]),
    (1, "iFLOOR 5", ["Breeze", "Steam"]),
    (2, "FLOOR ONE i5", ["Stretch", "Max"]),
    (2, "FLOOR ONE i6", ["Stretch"]),
    (3, "FLOOR ONE SWITCH i5", ["Stretch Breeze", "Power Kit", "Stretch"]),
    (3, "FLOOR ONE SWITCH i6", ["Stretch"]),
    (3, "FLOOR ONE SWITCH S6", ["Stretch Breeze", "Power Kit"]),
    (4, "FLOOR ONE S5", ["Pro", "Pro 2", "Steam", "Max", "Combo Power Kit", "Stretch"]),
    (5, "FLOOR ONE S6", ["", "Stretch Lite", "Stretch Pro", "Stretch Ultra"]),
    (5, "FLOOR ONE STRETCH S6", [""]),
    (5, "FLOOR ONE SWITCH S6", ["Stretch"]),
    (6, "FLOOR ONE S7", ["Pro", "FlashDry", "Steam", "Max Pro", "Stretch",
                        "Stretch Ultra", "Stretch Steam", "Stretch Steam Plus"]),
    (6, "FLOOR ONE SWITCH S7", ["", "Stretch"]),
    (7, "FLOOR ONE S7", ["Artist"]),
    (7, "FLOOR ONE S9", ["Artist", "Artist Premium", "Artist Pro", "Artist Steam"]),
    (7, "FLOOR ONE STATION S9", ["Artist"]),
    (8, "PURE ONE AIR", ["", "Pet"]), (8, "PURE ONE X", ["Essentials"]),
    (8, "A11", ["Hero", "Hero Ex"]), (8, "A20", [""]), (8, "A30S", [""]),
    (8, "PURE ONE A50S", [""]), (8, "PURE ONE A90S", [""]),
    (9, "PURE ONE S11", [""]), (9, "PURE ONE S15", ["Pro"]),
    (9, "PURE ONE S12", ["Pro Ex"]), (9, "PURE ONE S30", ["", "Pro"]),
    (9, "PURE ONE S50", ["", "Pro"]), (9, "PURE ONE S70", [""]),
    (9, "PURE ONE STATION", ["FurFree"]), (9, "PURE ONE STATION 5", ["", "Pro"]),
    (10, "TINECO iCARPET", [""]), (10, "TINECO CARPET ONE", ["", "Pro"]),
    (10, "CARPET ONE", ["Cruiser", "Spot", "Spot Essentials"]),
    (11, "MODA ONE", [""]), (11, "ZIVA ONE", [""]), (11, "TOASTY ONE", [""]),
]
PRODUCT_CATALOG = tuple(
    {
        "catalog_id": re.sub(r"[^a-z0-9]+", "-", f"{model} {spec}".lower()).strip("-"),
        "text": f"{model} {spec}".strip(), "model": model, "spec": spec, "page": page,
    }
    for page, model, specs in _GROUPS for spec in specs
)
_BY_ID = {entry["catalog_id"]: entry for entry in PRODUCT_CATALOG}


def text_fingerprint(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _normalized(text):
    return " ".join(text.split()).casefold()


def _pattern(text):
    return re.compile(r"(?<!\w)" + r"\s+".join(map(re.escape, text.split())) + r"(?!\w)",
                      re.IGNORECASE)


def catalog_mentions(text: str) -> list[dict]:
    candidates = []
    # Full names take precedence over standalone models at the same position.
    for entry in PRODUCT_CATALOG:
        for match in _pattern(entry["text"]).finditer(text):
            candidates.append({
                **{key: entry[key] for key in ("catalog_id", "model", "spec")},
                "start": match.start(), "end": match.end(),
                "origin": "catalog", "status": "confirmed",
            })
    for model in dict.fromkeys(entry["model"] for entry in PRODUCT_CATALOG):
        entry = next(entry for entry in PRODUCT_CATALOG if entry["model"] == model)
        for match in _pattern(model).finditer(text):
            candidates.append({
                "catalog_id": entry["catalog_id"], "model": model, "spec": "",
                "start": match.start(), "end": match.end(), "origin": "catalog",
                "status": "confirmed",
            })
    result = []
    for candidate in sorted(candidates, key=lambda c: (c["start"], -(c["end"] - c["start"]))):
        if not any(candidate["start"] < c["end"] and c["start"] < candidate["end"]
                   for c in result):
            result.append(candidate)
    return result


def validated_mentions(text: str, mentions) -> list[dict]:
    """Validate structure against original text; unknown names are deliberately allowed."""
    result = []
    if not isinstance(mentions, list):
        return result
    for item in mentions:
        if not isinstance(item, dict) or item.get("status", "confirmed") != "confirmed":
            continue
        start, end = item.get("start"), item.get("end")
        model, spec = item.get("model"), item.get("spec")
        context_model = item.get("context_model")
        if (type(start) is not int or type(end) is not int or
                not 0 <= start < end <= len(text) or
                not isinstance(model, str) or (not model.strip() and not (
                    isinstance(context_model, str) and 0 < len(context_model) <= 500
                    and isinstance(spec, str) and spec.strip())) or
                not isinstance(spec, str) or len(model) + len(spec) > 500 or
                any(ord(c) < 32 for c in model + spec)):
            continue
        name = f"{model.strip()} {spec.strip()}".strip()
        if _normalized(name) != _normalized(text[start:end]):
            continue
        if (start and text[start - 1].isalnum() and text[start].isalnum()) or (
            end < len(text) and text[end - 1].isalnum() and text[end].isalnum()
        ):
            continue
        origin = item.get("origin", "model_pattern")
        if origin not in {"catalog", "model_pattern", "manual"}:
            continue
        catalog_id = None
        if origin == "catalog":
            entry = _BY_ID.get(item.get("catalog_id"))
            if not entry or model.strip() != entry["model"] or spec.strip() not in {"", entry["spec"]}:
                continue
            catalog_id = entry["catalog_id"]
        confirmed = {
            "start": start, "end": end, "model": model.strip(), "spec": spec.strip(),
            "catalog_id": catalog_id, "origin": origin, "status": "confirmed",
        }
        if not model.strip():
            confirmed["context_model"] = context_model
        result.append(confirmed)
    accepted = []
    for item in sorted(result, key=lambda c: (c["start"], -(c["end"] - c["start"]))):
        if not any(item["start"] < other["end"] and other["start"] < item["end"]
                   for other in accepted):
            accepted.append(item)
    return accepted


def effective_mentions(segment: dict) -> list[dict]:
    text = segment.get("translated_text") or ""
    if segment.get("product_names_enabled") is False:
        return []
    saved = (validated_mentions(text, segment.get("product_mentions"))
             if segment.get("product_text_sha256") == text_fingerprint(text) else [])
    local = catalog_mentions(text)
    # Manual/model spans may extend a known standalone model into a new specification.
    return validated_mentions(text, saved + [
        c for c in local if not any(c["start"] < s["end"] and s["start"] < c["end"]
                                   for s in saved)
    ])


def contextual_segments(segments: list[dict]) -> list[dict]:
    """Discard spec-only annotations whose current block no longer supplies a model."""
    models = {}
    for segment in segments:
        block = segment.get("block_id")
        if not block or segment.get("excluded") or segment.get("product_names_enabled") is False:
            continue
        models.setdefault(block, set()).update(
            m["model"] for m in effective_mentions(segment) if m["model"])
    result = []
    for segment in segments:
        mentions = effective_mentions(segment)
        valid = [m for m in mentions if m["model"] or (
            segment.get("block_id") and
            m.get("context_model") in models.get(segment["block_id"], set()))]
        result.append({**segment, "product_mentions": valid,
                       "product_text_sha256": text_fingerprint(segment.get("translated_text") or "")})
    return result


def protect_names(text: str, mentions: list[dict]) -> tuple[str, dict]:
    """Random per-request markers cannot be forged by instructions in the subtitle."""
    nonce = uuid4().hex
    replacements = {}
    for index, mention in reversed(list(enumerate(mentions))):
        marker = f"__PN_{nonce}_{index}__"
        original = text[mention["start"]:mention["end"]]
        name = (f'{mention["model"]} {mention["spec"]}'.strip()
                if mention["origin"] == "catalog" else original)
        replacements[marker] = (name, mention)
        text = text[:mention["start"]] + marker + text[mention["end"]:]
    return text, replacements


def restore_names(text: str, replacements: dict) -> tuple[str, list[dict], list[str]]:
    warnings = []
    restored = []
    for marker, (name, mention) in replacements.items():
        if text.count(marker) != 1:
            warnings.append("product_name_marker_invalid")
        text = text.replace(marker, name)
        restored.append((name, mention))
    # Never expose internal markers from hallucinated/partial responses.
    text = re.sub(r"__PN_[A-Za-z0-9_]*", "", text)
    text = text.strip()
    candidates = []
    for name, mention in restored:
        for match in _pattern(name).finditer(text):
            candidates.append({**mention, "start": match.start(), "end": match.end()})
        if not _pattern(name).search(text):
            warnings.append("product_name_missing_after_translation")
    return text.strip(), validated_mentions(text.strip(), candidates), sorted(set(warnings))
