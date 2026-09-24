#!/usr/bin/env python3
"""Download every image from public Google Drive folders into the repo.

Used by .github/workflows/import-drive.yml. Folders must be shared as
"Anyone with the link". Existing files with the same name are overwritten.

Usage:  python scripts/import_drive.py FOLDER_ID:DEST_DIR [FOLDER_ID:DEST_DIR ...]
"""
import html
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
UA = {"User-Agent": "Mozilla/5.0 (monster-gallery importer)"}
ENTRY_RE = re.compile(
    r'id="entry-([\w-]+)".*?class="flip-entry-title">(.*?)</div>', re.S
)


def fetch(url: str, tries: int = 4) -> bytes:
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def list_folder(folder_id: str) -> list[tuple[str, str]]:
    page = fetch(f"https://drive.google.com/embeddedfolderview?id={folder_id}#list").decode("utf-8", "replace")
    seen, files = set(), []
    for file_id, title in ENTRY_RE.findall(page):
        name = html.unescape(title).strip()
        if file_id not in seen and Path(name).suffix.lower() in IMAGE_EXT:
            seen.add(file_id)
            files.append((file_id, name))
    return files


def download(file_id: str, dest: Path) -> str | None:
    data = fetch(f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t")
    if data[:1] == b"<":  # got an HTML page instead of the image
        return f"{dest.name}: bukan file gambar (akses ditolak?)"
    dest.write_bytes(data)
    return None


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    failed = 0
    for arg in sys.argv[1:]:
        folder_id, dest_dir = arg.split(":", 1)
        dest = ROOT / dest_dir
        dest.mkdir(parents=True, exist_ok=True)
        files = list_folder(folder_id)
        print(f"{dest_dir}: {len(files)} gambar ditemukan di Drive")
        if not files:
            sys.exit(f"Folder {folder_id} kosong atau tidak publik.")
        with ThreadPoolExecutor(max_workers=8) as pool:
            errors = [e for e in pool.map(lambda f: download(f[0], dest / f[1]), files) if e]
        for e in errors:
            print("  !", e)
        failed += len(errors)
        print(f"{dest_dir}: {len(files) - len(errors)} berhasil, {len(errors)} gagal")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
