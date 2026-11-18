"""Draw final-sized transparent subtitle layers using premultiplied supersampling."""

import hashlib
from io import BytesIO
import json
import math

from PIL import Image, ImageDraw

MAX_WORK_PIXELS = 16_000_000


def draw_layer(size, runs, resources, color, panel, panel_box):
    width, height = size
    scale = min(4, max(1, math.floor(math.sqrt(MAX_WORK_PIXELS / (width * height)))))
    image = Image.new("RGBA", (width * scale, height * scale))
    draw = ImageDraw.Draw(image)
    if panel[-2:] != "00":
        x, y, right, bottom = panel_box
        draw.rectangle((x * scale, y * scale, right * scale - 1, bottom * scale - 1),
                       fill=panel)
    for run in runs:
        draw.text((run["x_px"] * scale, run["baseline_px"] * scale), run["text"],
                  font=resources[run["font_type"]].font(run["font_size_px"] * scale),
                  fill=color, anchor="ls")
    if scale > 1:
        image = image.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue(), scale


def rasterize_text(element, summary):
    from . import layout as base

    resource = base._load_font_resource(summary["font_type"])
    size = summary["effective_font_size_px"]
    font = resource.font(size)
    text = element["text"]
    transform = element["extra"][0]
    width, height = transform["width"], transform["height"]
    bounds = font.getbbox(text, anchor="ls")
    bearing = min(0, bounds[0])
    measured_width = summary["measured_text_width_px"]
    ascent = max(summary["ascent_px"], -bounds[1])
    descent = max(summary["descent_px"], bounds[3])
    x = {"left": 0, "center": (width - measured_width) / 2,
         "right": width - measured_width}[summary["alignment"]]
    y = (height - ascent - descent) / 2
    runs = [{"start": 0, "end": len(text), "kind": "ordinary", "text": text,
             "font_type": resource.url, "font_sha256": resource.sha256,
             "font_size_px": size, "x_px": x - bearing, "baseline_px": y + ascent,
             "advance_px": font.getlength(text)}]
    content, scale = draw_layer(
        (width, height), runs, {resource.url: resource}, summary["text_color"],
        summary["background_color"], (x, y, x + measured_width, y + ascent + descent))
    identity = {"runs": runs, "transform": transform, "layout_version": base.LAYOUT_VERSION}
    layer_id = hashlib.sha256(json.dumps(identity, sort_keys=True).encode() + content).hexdigest()
    summary.update(text_runs=runs, render_layer_asset_id=layer_id, render_layer_url=None,
                   raster_scale=scale)
    if scale < 4:
        summary["warnings"].append("raster_sampling_limited")
    return {"type": "image", "source": f"subtitle-layer:{layer_id}",
            "extra": element["extra"]}, summary, {
                "id": layer_id, "content": content, "content_type": "image/png"}
