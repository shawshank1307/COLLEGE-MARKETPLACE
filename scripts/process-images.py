#!/usr/bin/env python3
"""Process and enhance JKLU photos for the marketplace site."""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

SRC = Path("/Users/shashank/.cursor/projects/Users-shashank-Desktop-Assesments/assets")
OUT = Path("/Users/shashank/Desktop/Assesments/campus-market/assets/jklu")
OUT.mkdir(parents=True, exist_ok=True)

TARGET_W = 1920
TARGET_H = 1080
JPEG_QUALITY = 92


def enhance(img: Image.Image) -> Image.Image:
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.12)
    img = ImageEnhance.Sharpness(img).enhance(1.35)
    img = ImageEnhance.Brightness(img).enhance(1.03)
    return img


def to_landscape(img: Image.Image) -> Image.Image:
    w, h = img.size
    if h > w:
        img = img.rotate(90, expand=True)
    return img


def cover_crop(img: Image.Image, tw: int, th: int) -> Image.Image:
    w, h = img.size
    scale = max(tw / w, th / h)
    nw, nh = int(w * scale), int(h * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def save_campus(img: Image.Image, name: str) -> None:
    img = to_landscape(img.convert("RGB"))
    img = enhance(img)
    img = cover_crop(img, TARGET_W, TARGET_H)
    img.save(OUT / name, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    # Also save medium for faster mobile load
    med = img.copy()
    med.thumbnail((1280, 720), Image.Resampling.LANCZOS)
    med.save(OUT / name.replace(".jpg", "-md.jpg"), "JPEG", quality=88, optimize=True)


def process_logo(src: Path) -> None:
    img = Image.open(src).convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    pad = 16
    canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(img, (pad, pad))
    img = canvas
    if img.width < 600:
        scale = max(2, 600 // img.width)
        img = img.resize((img.width * scale, img.height * scale), Image.Resampling.LANCZOS)
    img = ImageEnhance.Sharpness(img).enhance(1.2)
    img.save(OUT / "logo.png", "PNG", optimize=True)
    for name, size in [("logo-header.png", (220, 60)), ("logo-large.png", (320, 320)), ("favicon.png", (128, 128))]:
        copy = img.copy()
        copy.thumbnail(size, Image.Resampling.LANCZOS)
        copy.save(OUT / name, "PNG", optimize=True)


CAMPUS_MAP = [
    ("IMG-20260705-WA0043-9fac21d6-f28e-4e24-a6aa-4e1fd404e427.png", "campus-1.jpg"),
    ("IMG-20260705-WA0034-70f55a51-7208-4f58-8b2e-572ca7f3d745.png", "campus-2.jpg"),
    ("Screenshot_20260705-120317_Instagram-07e92ee3-bc4f-4eb8-9d98-ed80b295d700.png", "campus-3.jpg"),
    ("Screenshot_20260705-120023_Instagram-fd0c792e-5f55-4f82-aaa2-5275b8597c84.png", "campus-5.jpg"),
]

LOGO_SRC = SRC / "BACKGROUND_REMOVED_JKLU-7495db88-621c-42dd-ac9a-3a65df3fc7d9.png"

process_logo(LOGO_SRC)

for src_name, out_name in CAMPUS_MAP:
    save_campus(Image.open(SRC / src_name), out_name)
    print(f"✓ {out_name} ({(OUT / out_name).stat().st_size // 1024} KB)")

print("✓ logo.png, logo-header.png, logo-large.png, favicon.png")
