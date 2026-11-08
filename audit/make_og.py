"""Generate og-image.png (1200x630) for social sharing — daytime version.

Owner's request (8 November 2026): the link preview switches from the dark
version to a light one: a white background with the academy logo in its
current colours in the centre, under 300 KB, as the default preview for
every page.

Design: white background, the vertical logo-full (mark + Arabic wordmark
already drawn) centred, and the short gold line under it as before.
No Arabic text is drawn with PIL, to avoid glyph-shaping problems.

The image URL carries a version (`?v=2` in index.html and link-preview.ts)
so that WhatsApp and others ignore the cached dark copy. Whoever redraws it
bumps the number in both places.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og-image.png"
LOGO = ROOT / "public" / "logo-full.png"

W, H = 1200, 630
BG = (255, 255, 255, 255)       # white
GOLD = (250, 188, 5, 255)       # #FABC05
MAX_BYTES = 300 * 1024

img = Image.new("RGBA", (W, H), BG)

# Logo: 74% of the canvas height, aspect ratio kept, centred
logo = Image.open(LOGO).convert("RGBA")
target_h = int(H * 0.74)
scale = target_h / logo.height
target_w = int(logo.width * scale)
logo = logo.resize((target_w, target_h), Image.LANCZOS)
img.alpha_composite(logo, ((W - target_w) // 2, (H - target_h) // 2))

# Short gold line under the logo
ay = (H + target_h) // 2 + 22
ImageDraw.Draw(img).line((W // 2 - 90, ay, W // 2 + 90, ay), fill=GOLD, width=3)

img.convert("RGB").save(OUT, "PNG", optimize=True)
size = OUT.stat().st_size
assert size < MAX_BYTES, f"og-image.png is {size} bytes — over the {MAX_BYTES} limit"
print("saved", OUT, img.size, size, "bytes")
