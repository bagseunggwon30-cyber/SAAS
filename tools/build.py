#!/usr/bin/env python3
"""src/template.html + assets/ + src/photos.json  ->  index.html (이미지를 data URI로 내장한 단일 파일)

  python3 tools/build.py

assets/photos/P01.jpg ...  현장 사진 (보관함 기본 사진, 캡션은 src/photos.json)
assets/crops/<장비id>.jpg  장비 카드의 현장 크롭 이미지
assets/products/<장비id>.jpg|png|webp  제품 공식 사진(있으면 카드에 '현장 / 제품' 토글이 생김)
"""
import base64
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def data_uri(path: pathlib.Path) -> str:
    return f"data:{MIME[path.suffix.lower()]};base64," + base64.b64encode(path.read_bytes()).decode()


def collect(folder: str) -> dict:
    d = ROOT / "assets" / folder
    return {p.stem: data_uri(p) for p in sorted(d.iterdir()) if p.suffix.lower() in MIME} if d.is_dir() else {}


def js(obj) -> str:
    # <script> 안에서 안전하도록 '<' 이스케이프
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def main() -> None:
    tpl = (ROOT / "src" / "template.html").read_text(encoding="utf-8")
    caps = json.loads((ROOT / "src" / "photos.json").read_text(encoding="utf-8"))

    photos = []
    for ref, uri in collect("photos").items():
        c = caps.get(ref, {})
        photos.append({
            "id": f"IMG-seed-{ref}", "ref": ref, "slotNo": "#" + ref[1:],
            "title": c.get("title", ref), "equipName": c.get("equipName", ""), "memo": c.get("memo", ""),
            "dataUrl": uri,
        })
    state = {"v": 3, "updatedAt": 1, "photos": photos, "productImages": {}}

    for marker, value in (
        ("/*__EMBEDDED_STATE__*/null", js(state)),
        ("/*__CROPS__*/{}", js(collect("crops"))),
        ("/*__PRODUCTS__*/{}", js(collect("products"))),
    ):
        if tpl.count(marker) != 1:
            sys.exit(f"template marker not found exactly once: {marker}")
        tpl = tpl.replace(marker, value)

    out = ROOT / "index.html"
    out.write_text(tpl, encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}  {out.stat().st_size / 1024 / 1024:.1f} MB  "
          f"(photos {len(photos)}, crops {len(collect('crops'))}, products {len(collect('products'))})")


if __name__ == "__main__":
    main()
