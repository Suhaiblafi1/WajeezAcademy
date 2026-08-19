"""Generate og-image.png (1200x630) for social sharing.

Design: deep charcoal background, subtle radial glow, gold hairline frame,
the vertical logo-full (mark + Arabic wordmark already drawn) centered.
No Arabic text is rendered with PIL to avoid glyph shaping issues.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og-image.png"
LOGO = ROOT / "public" / "logo-full.png"

W, H = 1200, 630
BG = (13, 13, 13, 255)          # #0D0D0D
GOLD = (250, 188, 5, 255)       # #FABC05
TEAL = (56, 167, 180, 255)      # brand teal sampled from logo

img = Image.new("RGBA", (W, H), BG)

# Soft teal radial glow behind the logo
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((W // 2 - 320, H // 2 - 320, W // 2 + 320, H // 2 + 320),
           fill=(TEAL[0], TEAL[1], TEAL[2], 46))
glow = glow.filter(ImageFilter.GaussianBlur(120))
img = Image.alpha_composite(img, glow)

# Gold hairline frame inset
frame = ImageDraw.Draw(img)
frame.rectangle((28, 28, W - 29, H - 29), outline=(GOLD[0], GOLD[1], GOLD[2], 140), width=2)

# Logo: scale to 74% of canvas height, keep aspect
logo = Image.open(LOGO).convert("RGBA")
target_h = int(H * 0.74)
scale = target_h / logo.height
target_w = int(logo.width * scale)
logo = logo.resize((target_w, target_h), Image.LANCZOS)

# Slight dark plate behind logo for contrast on the glow
img.alpha_composite(logo, ((W - target_w) // 2, (H - target_h) // 2))

# Thin gold baseline accent under the logo
ay = (H + target_h) // 2 + 22
frame.line((W // 2 - 90, ay, W // 2 + 90, ay), fill=GOLD, width=3)

img.convert("RGB").save(OUT, "PNG", optimize=True)
print("saved", OUT, img.size)
