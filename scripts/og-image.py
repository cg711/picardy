"""Compose public/og-image.png — the 1200x630 link preview.

Run from the project root, with the brand kit checked out alongside:

    python3 scripts/og-image.py

The result is committed, so nothing in the build depends on this script or on the
sibling directory. Re-run it only when the lockup or the tagline changes.

The brand kit ships a square app icon under the name og-image.png; that is the
wrong shape for a link preview and every scraper crops it. This composes the
kit's own rendered lockup onto a 1200x630 canvas instead, so the artwork is the
kit's and only the framing is ours.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (16, 13, 9)

img = Image.new("RGB", (W, H), BG)

# The same two warm glows the app body paints, so a shared link looks like the app.
def glow(cx, cy, radius, colour):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = layer.load()
    for y in range(H):
        for x in range(0, W, 2):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d < radius:
                a = int(255 * (1 - d / radius) ** 2)
                px[x, y] = (*colour, a)
                px[min(x + 1, W - 1), y] = (*colour, a)
    return layer

img = Image.alpha_composite(img.convert("RGBA"), glow(180, -60, 900, (36, 29, 19)))
img = Image.alpha_composite(img, glow(1140, 0, 700, (29, 26, 34)))

# The lockup PNG is padded to a fixed frame; crop to the ink so the artwork is
# what gets centred, not the whitespace around it.
lockup = Image.open("../picardy-brand/png/logo-lockup-1600.png").convert("RGBA")
lockup = lockup.crop(lockup.getbbox())
target_w = 720
lockup = lockup.resize((target_w, round(lockup.height * target_w / lockup.width)), Image.LANCZOS)

draw = ImageDraw.Draw(img)
font = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 30)
line = "chord progressions, explained"
tw = draw.textbbox((0, 0), line, font=font)[2]

GAP = 44
block = lockup.height + GAP + 30
top = (H - block) // 2
img.alpha_composite(lockup, ((W - lockup.width) // 2, top))
draw.text(((W - tw) // 2, top + lockup.height + GAP), line, font=font, fill=(173, 163, 148))

img.convert("RGB").save("public/og-image.png", optimize=True)
print("wrote public/og-image.png", img.size)
