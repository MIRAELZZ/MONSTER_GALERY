#!/usr/bin/env python3
"""Build the static Monster Gallery site into ./_site.

- Scans Monster_Detail (Plan A) and Monster_Detail1 (Plan B) for images.
- Copies the originals, generates small WebP thumbnails for fast loading.
- Writes manifest.json that the page reads.

Usage:  python scripts/build.py            (needs: pip install pillow)
"""
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow belum terpasang. Jalankan: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"

PLANS = [
    {"id": "A", "label": "Plan A", "folder": "Monster_Detail"},
    {"id": "B", "label": "Plan B", "folder": "Monster_Detail1"},
]
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
THUMB_WIDTH = 480
THUMB_QUALITY = 78


def pretty_name(stem: str) -> str:
    return " ".join(stem.replace("_", " ").replace("-", " ").split())


def make_thumb(src: Path, dest: Path) -> tuple[int, int]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        w, h = im.size
        im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
        if w > THUMB_WIDTH:
            im = im.resize((THUMB_WIDTH, round(h * THUMB_WIDTH / w)), Image.LANCZOS)
        im.save(dest, "WEBP", quality=THUMB_QUALITY, method=6)
    return w, h


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()

    shutil.copy2(ROOT / "index.html", OUT / "index.html")
    shutil.copytree(ROOT / "assets", OUT / "assets")
    (OUT / ".nojekyll").touch()

    manifest = {"generated": datetime.now(timezone.utc).isoformat(), "plans": []}
    total = 0

    for plan in PLANS:
        folder = ROOT / plan["folder"]
        items = []
        files = sorted(
            (p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXT),
            key=lambda p: p.relative_to(folder).as_posix().lower(),
        ) if folder.exists() else []

        for path in files:
            rel = path.relative_to(folder).as_posix()
            dest = OUT / plan["folder"] / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)

            thumb_rel = Path("thumbs") / plan["folder"] / Path(rel).with_suffix(".webp")
            try:
                w, h = make_thumb(path, OUT / thumb_rel)
                thumb = thumb_rel.as_posix()
            except Exception as exc:  # corrupt / unsupported file: fall back to original
                print(f"  ! thumbnail gagal untuk {rel}: {exc}")
                w = h = 0
                thumb = f"{plan['folder']}/{rel}"

            items.append({
                "name": pretty_name(path.stem),
                "file": path.name,
                "path": rel,
                "src": f"{plan['folder']}/{rel}",
                "thumb": thumb,
                "w": w,
                "h": h,
            })

        print(f"{plan['label']} ({plan['folder']}): {len(items)} gambar")
        total += len(items)
        manifest["plans"].append({**plan, "items": items})

    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"Selesai: {total} gambar -> {OUT}")


if __name__ == "__main__":
    main()
