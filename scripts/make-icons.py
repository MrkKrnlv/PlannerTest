"""Генерирует иконки PWA: тёмный квадрат и полоса дня (тот же мотив, что в интерфейсе).
Запуск: python3 scripts/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

INK = (29, 35, 43, 255)
PAPER = (241, 243, 246, 255)
MARKER = (246, 212, 57, 255)
OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def draw(size, *, maskable=False, rounded=True):
    s = 4  # суперсэмплинг для гладких краёв
    S = size * s
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable or not rounded:
        d.rectangle([0, 0, S, S], fill=INK)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=INK)

    safe = 0.62 if maskable else 0.74  # maskable: всё важное в безопасной зоне
    w = S * safe
    h = S * 0.15
    x0 = (S - w) / 2
    y0 = (S - h) / 2
    gap = S * 0.035
    parts = [(0.38, PAPER), (0.30, MARKER), (0.32, PAPER)]
    usable = w - gap * (len(parts) - 1)
    x = x0
    for frac, color in parts:
        seg = usable * frac
        d.rounded_rectangle([x, y0, x + seg, y0 + h], radius=int(h * 0.38), fill=color)
        x += seg + gap
    return img.resize((size, size), Image.LANCZOS)


draw(192).save(OUT / "icon-192.png")
draw(512).save(OUT / "icon-512.png")
draw(512, maskable=True).save(OUT / "icon-maskable-512.png")
draw(180, rounded=False).save(OUT / "apple-touch-icon.png")

svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#1d232b"/>
<rect x="8" y="27" width="16.6" height="10" rx="4" fill="#f1f3f6"/>
<rect x="26.8" y="27" width="13.1" height="10" rx="4" fill="#f6d439"/>
<rect x="42.1" y="27" width="13.9" height="10" rx="4" fill="#f1f3f6"/>
</svg>
"""
(OUT / "icon.svg").write_text(svg)
print("icons ->", OUT)
