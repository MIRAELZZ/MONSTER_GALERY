# 👾 Monster Gallery

Web galeri monster: **Plan A** dan **Plan B**, di-host gratis lewat GitHub Pages.

| Plan   | Folder di repo      | Asal folder di PC     |
|--------|---------------------|-----------------------|
| Plan A | `Monster_Detail/`   | `D:\Monster_Detail`   |
| Plan B | `Monster_Detail1/`  | `D:\Monster_Detail1`  |

Nama monster diambil dari **nama file PNG**, dan nama file aslinya juga ikut tampil
(`Fire_Dragon.png` → tampil sebagai **Fire Dragon** + `Fire_Dragon.png`).

## Fitur
- Tab Semua / Plan A / Plan B + jumlah gambar
- Cari nama monster & urutkan A→Z / Z→A
- Klik gambar untuk tampilan besar (panah ← →, geser di HP, Esc untuk tutup)
- **Ringan**: thumbnail WebP kecil dibuat otomatis, gambar di-*lazy load*,
  ukuran asli baru dimuat saat dibuka

## Cara menambah gambar
Salin semua PNG ke folder `Monster_Detail/` (Plan A) dan `Monster_Detail1/` (Plan B), lalu push.
Setiap push, GitHub Actions otomatis membuat thumbnail dan memperbarui website.
Tidak perlu mengedit kode apa pun.

## Mengaktifkan GitHub Pages (sekali saja)
1. Repo → **Settings → Pages**
2. **Source: GitHub Actions**
3. Website: `https://miraelzz.github.io/MONSTER_GALERY/`

## Preview di komputer sendiri
```bash
pip install pillow
python scripts/build.py
python -m http.server -d _site 8000   # buka http://localhost:8000
```
