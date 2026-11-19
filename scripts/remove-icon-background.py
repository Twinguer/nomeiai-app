"""Remove external background from icon and generate web/mobile sizes."""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image

SIZES = {
    "icon-1024.png": 1024,
    "icon-512.png": 512,
    "icon.png": 512,
    "icon-192.png": 192,
    "apple-touch-icon.png": 180,
    "favicon-32.png": 32,
}

MOBILE_SIZES = {
    "icon.png": 1024,
    "android-icon-foreground.png": 1024,
    "splash-icon.png": 512,
    "favicon.png": 48,
}

TEAL_BG = (4, 93, 111, 255)


def is_external_background(r: int, g: int, b: int, a: int = 255) -> bool:
    if a < 10:
        return True
    if r > 235 and g > 235 and b > 235:
        return True
    if r < 30 and g < 30 and b < 30:
        return True
    return False


def remove_external_background(src: Path) -> Image.Image:
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    pixels = img.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if not visited[y][x] and is_external_background(*pixels[x, y]):
                visited[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y][x] and is_external_background(*pixels[x, y]):
                visited[y][x] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        r, g, b, _a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if is_external_background(*pixels[nx, ny]):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    return img


def save_sizes(img: Image.Image, out_dir: Path, sizes: dict[str, int]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, size in sizes.items():
        out = img.resize((size, size), Image.Resampling.LANCZOS)
        path = out_dir / name
        out.save(path, "PNG")
        print(f"saved {path} ({size}x{size}, {path.stat().st_size} bytes)")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "public" / "icon-source.png"
    mobile_dir = root.parent / "Nomeia-Ai_Rankings-App" / "Nomeia-Ai_Rankings" / "assets" / "images"

    img = remove_external_background(src)
    save_sizes(img, root / "public", SIZES)

    if mobile_dir.parent.exists():
        save_sizes(img, mobile_dir, MOBILE_SIZES)
        bg = Image.new("RGBA", (1024, 1024), TEAL_BG)
        bg.save(mobile_dir / "android-icon-background.png", "PNG")
        print(f"saved {mobile_dir / 'android-icon-background.png'}")


if __name__ == "__main__":
    main()
