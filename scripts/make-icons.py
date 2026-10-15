"""Иконки PWA: тёмный квадрат и три блока разной длины (знак планера).
Запуск: python3 scripts/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

INK = (79, 93, 255, 255)  # индиго, как кнопки в приложении
PAPER = (255, 255, 255, 240)
SUN = (255, 210, 122, 255)
OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

BARS = [(0.60, PAPER), (1.0, SUN), (0.40, PAPER)]


def draw(size, *, maskable=False, rounded=True):
    s = 4
    S = size * s
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable or not rounded:
        d.rectangle([0, 0, S, S], fill=INK)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.24), fill=INK)
    zone = 0.5 if maskable else 0.6
    w = S * zone
    h = S * 0.11
    gap = S * 0.06
    total = h * 3 + gap * 2
    x0 = (S - w) / 2
    y = (S - total) / 2
    for frac, color in BARS:
        d.rounded_rectangle([x0, y, x0 + w * frac, y + h], radius=int(h / 2), fill=color)
        y += h + gap
    return img.resize((size, size), Image.LANCZOS)


draw(192).save(OUT / "icon-192.png")
draw(512).save(OUT / "icon-512.png")
draw(512, maskable=True).save(OUT / "icon-maskable-512.png")
draw(180, rounded=False).save(OUT / "apple-touch-icon.png")

svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="15" fill="#4f5dff"/>
<rect x="13" y="17" width="23" height="7" rx="3.5" fill="#ffffff"/>
<rect x="13" y="28.5" width="38" height="7" rx="3.5" fill="#ffd27a"/>
<rect x="13" y="40" width="15" height="7" rx="3.5" fill="#ffffff"/>
</svg>
"""
(OUT / "icon.svg").write_text(svg)
print("icons ->", OUT)
