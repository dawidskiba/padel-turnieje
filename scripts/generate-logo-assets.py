#!/usr/bin/env python3
"""Generate web-ready logo assets from the supplied Garden Padel artwork.

The originals are 6000px square PNGs with the horizontal lockup floating inside
a lot of empty canvas, so nothing can be used as-is. This crops to the artwork,
scales it down, and derives the one variant the designer did not supply: a
transparent lockup with white ink, for dark surfaces.

That derivation works by recolouring — the transparent original has emerald ink
and a sage circle, so each pixel is classified as whichever of the two it is
closer to, and only the emerald half is repainted white. Keying out a background
would not work, because it would take the sage with it.

Re-run whenever the source artwork changes:

    pip install pillow numpy
    python scripts/generate-logo-assets.py

If the designer ever supplies SVG, delete this and use that instead.
"""

import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
ASSETS = os.path.join(SRC, "assets")
PUBLIC = os.path.join(ROOT, "public")

EMERALD = np.array([0, 51, 51])
SAGE = np.array([148, 180, 135])


def load_cropped(name):
    """Open a transparent source and crop away the empty canvas around it."""
    image = Image.open(os.path.join(SRC, name)).convert("RGBA")
    return image.crop(image.getchannel("A").getbbox())


def recolour_ink(image, rgb):
    """Repaint the emerald ink, leave the sage circle alone, keep alpha."""
    data = np.array(image).astype(np.int16)
    colours, alpha = data[..., :3], data[..., 3]
    is_ink = (
        np.linalg.norm(colours - EMERALD, axis=-1)
        <= np.linalg.norm(colours - SAGE, axis=-1)
    ) & (alpha > 0)

    out = data.copy()
    for channel in range(3):
        out[..., channel][is_ink] = rgb[channel]
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def save(image, path, width):
    height = round(width * image.size[1] / image.size[0])
    image.resize((width, height), Image.LANCZOS).save(path, optimize=True)
    print(f"  {os.path.relpath(path, ROOT):40} {width}x{height}")


def split_mark(lockup):
    """Isolate the tree from the wordmark at the first wide gap of empty columns."""
    columns = (np.array(lockup.getchannel("A")) > 8).sum(axis=0)
    run = 0
    for x, filled in enumerate(columns):
        if filled:
            run = 0
            continue
        run += 1
        if run > 40 and columns[:x].sum() > 0:
            mark = lockup.crop((0, 0, x - run, lockup.size[1]))
            return mark.crop(mark.getchannel("A").getbbox())
    raise SystemExit("could not find the gap between the mark and the wordmark")


def main():
    os.makedirs(ASSETS, exist_ok=True)
    os.makedirs(PUBLIC, exist_ok=True)

    lockup = load_cropped("GLOWNE_POZIOM_BLANK.png")
    white_lockup = recolour_ink(lockup, (255, 255, 255))

    print("header lockups (transparent):")
    save(lockup, os.path.join(ASSETS, "logo-horizontal-light.png"), 960)
    save(white_lockup, os.path.join(ASSETS, "logo-horizontal-dark.png"), 960)

    mark = split_mark(lockup)
    white_mark = recolour_ink(mark, (255, 255, 255))

    print("mark (transparent):")
    save(mark, os.path.join(ASSETS, "mark-light.png"), 256)
    save(white_mark, os.path.join(ASSETS, "mark-dark.png"), 256)

    # The favicon keeps the emerald ground: a transparent mark would vanish
    # against a tab bar of the same colour as its ink.
    width, height = mark.size
    side = round(max(width, height) * 1.32)
    favicon = Image.new("RGBA", (side, side), (0, 51, 51, 255))
    favicon.alpha_composite(white_mark, ((side - width) // 2, (side - height) // 2))

    print("favicons (emerald ground):")
    for size, name in ((512, "favicon-512.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")):
        save(favicon, os.path.join(PUBLIC, name), size)

    # Installed-app icons. Android draws these at whatever size it likes, so both
    # 192 and 512 are required by the manifest spec.
    print("app icons:")
    for size in (192, 512):
        save(favicon, os.path.join(PUBLIC, f"icon-{size}.png"), size)

    # A maskable icon is cropped to whatever shape the launcher prefers — circle,
    # squircle, teardrop — so anything outside the middle 80% can be cut off. The
    # standard favicon padding is far too tight for that, hence a separate render
    # with the mark well inside the safe zone.
    maskable_side = round(max(width, height) * 2.1)
    maskable = Image.new("RGBA", (maskable_side, maskable_side), (0, 51, 51, 255))
    maskable.alpha_composite(
        white_mark,
        ((maskable_side - width) // 2, (maskable_side - height) // 2),
    )
    print("maskable icon (extra padding for launcher cropping):")
    save(maskable, os.path.join(PUBLIC, "icon-maskable-512.png"), 512)


if __name__ == "__main__":
    main()
