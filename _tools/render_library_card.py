#!/usr/bin/env python3
"""
render_library_card.py — generate a per-patron Library Card PNG by overlaying
patron data onto the blank template image.

Usage:
    python3 _tools/render_library_card.py \
        --name "Dr. David Sullivan" \
        --number "00 001" \
        --issued "11 May 2026" \
        --tier "Reader" \
        --standing "Active" \
        --out "Library_Card_patron_00001.png"

The blank template lives at `Library_Card_Blank_Template_v1.png` at the project
root, sized 1586 × 992 px. Overlay coordinates are calibrated to that template
resolution.

This tool is the reference implementation for the v29 build. Claude Code may
re-implement in TypeScript/Node (using sharp or jimp) for production server-
side rendering at signup time, or it may shell out to this Python script if
the runtime supports it. Either way, the coordinate map below is the source
of truth.
"""

import argparse
import os
import sys
from PIL import Image, ImageDraw, ImageFont

# Template + output palette
NAVY = '#1A2F4E'
TEMPLATE_PATH = 'Library_Card_Blank_Template_v1.png'

# Coordinate map for the 1586 × 992 template. Anchored on the center-middle of
# each text run (anchor='mm' in PIL). Sizes in points.
#
# To translate to a different template resolution, scale by the new template's
# width and height. The ratios below are stable.
COORDS = [
    # field      x_ratio  y_ratio  size  weight                       anchor
    ('name',     0.500,   0.380,   88,   'DejaVuSerif-BoldItalic.ttf', 'mm'),
    ('patron',   0.225,   0.610,   40,   'DejaVuSerif.ttf',            'mm'),
    ('issued',   0.440,   0.610,   40,   'DejaVuSerif.ttf',            'mm'),
    ('tier',     0.650,   0.610,   40,   'DejaVuSerif.ttf',            'mm'),
    ('standing', 0.855,   0.610,   40,   'DejaVuSerif.ttf',            'mm'),
]

FONT_PATHS = [
    '/usr/share/fonts/truetype/dejavu',
    '/usr/share/fonts/truetype/liberation',
    '/Library/Fonts',
    '/System/Library/Fonts',
    'C:/Windows/Fonts',
]


def find_font(fontname, size):
    for base in FONT_PATHS:
        path = os.path.join(base, fontname)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    # Fallback chain — try common substitutions
    for substitute in ['DejaVuSerif.ttf', 'LiberationSerif-Regular.ttf', 'Times.ttc']:
        for base in FONT_PATHS:
            path = os.path.join(base, substitute)
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    pass
    return ImageFont.load_default()


def render_card(name, number, issued, tier, standing, out_path,
                template_path=TEMPLATE_PATH):
    if not os.path.exists(template_path):
        sys.exit(f'Template not found: {template_path}')

    img = Image.open(template_path).convert('RGB')
    W, H = img.size
    draw = ImageDraw.Draw(img)

    fields = {
        'name': name,
        'patron': number,
        'issued': issued,
        'tier': tier,
        'standing': standing,
    }

    for field, x_ratio, y_ratio, size, fontname, anchor in COORDS:
        x = int(W * x_ratio)
        y = int(H * y_ratio)
        font = find_font(fontname, size)
        draw.text((x, y), fields[field], font=font, fill=NAVY, anchor=anchor)

    img.save(out_path, 'PNG')
    return out_path, os.path.getsize(out_path)


def main():
    ap = argparse.ArgumentParser(description='Render a per-patron Library Card PNG.')
    ap.add_argument('--name',     required=True,  help='Patron full name')
    ap.add_argument('--number',   required=True,  help='Patron number, e.g. "00 001"')
    ap.add_argument('--issued',   required=True,  help='Issue date, e.g. "11 May 2026"')
    ap.add_argument('--tier',     default='Reader', help='Tier (default: Reader)')
    ap.add_argument('--standing', default='Active', help='Standing (default: Active)')
    ap.add_argument('--out',      required=True,  help='Output PNG path')
    ap.add_argument('--template', default=TEMPLATE_PATH, help='Blank template path')
    args = ap.parse_args()

    out, size = render_card(
        args.name, args.number, args.issued, args.tier, args.standing,
        args.out, template_path=args.template
    )
    print(f'Saved: {out}  ({size:,} bytes)')


if __name__ == '__main__':
    main()
