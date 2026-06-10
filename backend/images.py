"""Image helpers: blur sensitive regions, optimize/resize."""

from __future__ import annotations

import os
from typing import Optional


def blur_regions(input_path: str, regions: list[dict], output_path: Optional[str] = None) -> str:
    """Blur the given regions (fractions of image size) and write the result.

    regions: list of {x, y, width, height} as fractions in [0, 1].
    """
    from PIL import Image, ImageFilter

    img = Image.open(input_path).convert("RGB")
    w, h = img.size

    for r in regions:
        x = int(float(r.get("x", 0)) * w)
        y = int(float(r.get("y", 0)) * h)
        rw = int(float(r.get("width", 0)) * w)
        rh = int(float(r.get("height", 0)) * h)
        x = max(0, min(x, w))
        y = max(0, min(y, h))
        rw = max(0, min(rw, w - x))
        rh = max(0, min(rh, h - y))
        if rw <= 0 or rh <= 0:
            continue
        box = (x, y, x + rw, y + rh)
        region = img.crop(box)
        # Strong blur relative to region size
        radius = max(8, min(rw, rh) // 3)
        region = region.filter(ImageFilter.GaussianBlur(radius))
        img.paste(region, box)

    out = output_path or input_path
    img.save(out)
    return out


def crop_region(input_path: str, region: dict, output_path: Optional[str] = None) -> str:
    """Crop to a region given as fractions {x, y, width, height} in [0, 1]."""
    from PIL import Image

    img = Image.open(input_path)
    w, h = img.size
    x = int(max(0.0, float(region.get("x", 0))) * w)
    y = int(max(0.0, float(region.get("y", 0))) * h)
    rw = int(float(region.get("width", 1)) * w)
    rh = int(float(region.get("height", 1)) * h)
    rw = max(1, min(rw, w - x))
    rh = max(1, min(rh, h - y))
    cropped = img.crop((x, y, x + rw, y + rh))
    out = output_path or input_path
    cropped.save(out)
    return out


def optimize_image(input_path: str, output_path: Optional[str] = None,
                   max_width: int = 1920, quality: int = 85,
                   fmt: Optional[str] = None) -> str:
    """Resize down to max_width and recompress."""
    from PIL import Image

    img = Image.open(input_path)
    w, h = img.size
    if w > max_width:
        new_h = int(h * (max_width / w))
        img = img.resize((max_width, new_h), Image.LANCZOS)

    out = output_path or input_path
    ext = (fmt or os.path.splitext(out)[1].lstrip(".") or "png").lower()
    if ext in ("jpg", "jpeg"):
        img = img.convert("RGB")
        img.save(out, "JPEG", quality=quality, optimize=True)
    else:
        img.save(out, optimize=True)
    return out
