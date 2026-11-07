#!/usr/bin/env python3
"""Build the static Monster Gallery site into ./_site.

- Scans the plan folders listed in PLANS (Monster_Detail = Plan A,
  Monster_Detail1 = Plan B, ...) for images, including subfolders.
- Copies the originals, generates small WebP thumbnails for fast loading.
- Writes manifest.json that the page reads.

Thumbnails are cached in ./.thumbcache by file content hash, so rebuilds only
process new or changed images.

Originals: by default they are copied into ./_site. If ORIGINALS_BASE is set
(e.g. https://raw.githubusercontent.com/OWNER/REPO/COMMIT/), they are not
copied and the page loads them from that URL instead. This keeps the Pages
upload small (thumbnails only), well under the 1 GB site limit.

Usage:  python scripts/build.py            (needs: pip install pillow)
"""
import hashlib
import json
import os
import re
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow belum terpasang. Jalankan: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"
CACHE = ROOT / ".thumbcache"

PLANS = [
    {"id": "A", "label": "Plan A", "folder": "Monster_Detail"},
    {"id": "B", "label": "Plan B", "folder": "Monster_Detail1"},
    {"id": "C", "label": "Plan C", "folder": "Monster_Detail2"},
    {"id": "D", "label": "Plan D", "folder": "Monster_Detail3"},
    {"id": "E", "label": "Plan E", "folder": "Monster_Detail4"},
    {"id": "F", "label": "Plan F", "folder": "Monster_Detail5"},
]
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
THUMB_WIDTH = 480
THUMB_QUALITY = 78


def pretty_name(stem: str) -> str:
    """'AbominationElin_skel' -> 'Abomination Elin' (the exact filename is shown separately)."""
    stem = re.sub(r"[_\-. ]skel$", "", stem, flags=re.I)
    stem = re.sub(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", stem)
    return " ".join(stem.replace("_", " ").replace("-", " ").split())


def make_thumb(src: Path) -> tuple[Path | None, int, int]:
    """Return (cached thumbnail path, original width, original height)."""
    digest = hashlib.sha1(src.read_bytes()).hexdigest()
    cached = CACHE / f"{digest}.webp"
    meta = CACHE / f"{digest}.json"
    if cached.exists() and meta.exists():
        w, h = json.loads(meta.read_text())
        return cached, w, h
    try:
        with Image.open(src) as im:
            w, h = im.size
            im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
            if w > THUMB_WIDTH:
                im = im.resize((THUMB_WIDTH, round(h * THUMB_WIDTH / w)), Image.LANCZOS)
            im.save(cached, "WEBP", quality=THUMB_QUALITY, method=4)
    except Exception as exc:  # corrupt / unsupported file: fall back to original
        print(f"  ! thumbnail gagal untuk {src.name}: {exc}")
        return None, 0, 0
    meta.write_text(json.dumps([w, h]))
    return cached, w, h


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    CACHE.mkdir(exist_ok=True)

    shutil.copy2(ROOT / "index.html", OUT / "index.html")
    shutil.copytree(ROOT / "assets", OUT / "assets")
    (OUT / ".nojekyll").touch()

    base = os.environ.get("ORIGINALS_BASE", "").strip()
    if base and not base.endswith("/"):
        base += "/"
    manifest = {"generated": datetime.now(timezone.utc).isoformat(), "originals": base, "plans": []}
    total = 0

    with ProcessPoolExecutor(max_workers=os.cpu_count()) as pool:
        for plan in PLANS:
            folder = ROOT / plan["folder"]
            files = sorted(
                (p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXT),
                key=lambda p: p.relative_to(folder).as_posix().lower(),
            ) if folder.exists() else []

            items = []
            for path, (cached, w, h) in zip(files, pool.map(make_thumb, files, chunksize=8)):
                rel = path.relative_to(folder).as_posix()
                if not base:
                    dest = OUT / plan["folder"] / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(path, dest)

                if cached:
                    thumb_rel = Path("thumbs") / plan["folder"] / Path(rel).with_suffix(".webp")
                    (OUT / thumb_rel).parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(cached, OUT / thumb_rel)
                    thumb = thumb_rel.as_posix()
                else:  # no thumbnail: show the original in the grid
                    thumb = f"{base}{quote(plan['folder'])}/{quote(rel)}" if base else f"{plan['folder']}/{rel}"

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
    print(f"Selesai: {total} gambar -> {OUT}" + (f" (gambar asli dari {base})" if base else ""))


if __name__ == "__main__":
    main()
