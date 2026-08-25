"""
Generates the map-pin favicon set. Run: python scripts/make-favicon.py

Written out rather than committed as opaque binaries so the icon can be
re-tinted or resized without hunting for the original. Uses only the standard
library — zlib and struct are enough to write a PNG, and the shape is simple
enough to rasterise directly.
"""
import math, struct, zlib, os

PIN = (0x22, 0xc5, 0x5e)      # --open green, legible on light and dark tabs
HOLE = (0xff, 0xff, 0xff)
NAVY = (0x0b, 0x12, 0x20)     # --bg, for the iOS icon which cannot be transparent

# Geometry in a unit square. A pin is a circle unioned with the triangle formed
# by the tip and the circle's two tangent points.
CX, CY, R = 0.5, 0.38, 0.30
TIP_Y = 0.95
HOLE_R = 0.125

_d = TIP_Y - CY
_phi = math.acos(R / _d)
_TX, _TY = R * math.sin(_phi), CY + R * math.cos(_phi)


def _inside(x, y):
    if (x - CX) ** 2 + (y - CY) ** 2 <= R * R:
        return True
    # Barycentric point-in-triangle against tip, and the two tangent points.
    ax, ay = CX, TIP_Y
    bx, by = CX - _TX, _TY
    cx2, cy2 = CX + _TX, _TY
    d = (by - cy2) * (ax - cx2) + (cx2 - bx) * (ay - cy2)
    if d == 0:
        return False
    a = ((by - cy2) * (x - cx2) + (cx2 - bx) * (y - cy2)) / d
    b = ((cy2 - ay) * (x - cx2) + (ax - cx2) * (y - cy2)) / d
    return a >= 0 and b >= 0 and (a + b) <= 1


def _hole(x, y):
    return (x - CX) ** 2 + (y - CY) ** 2 <= HOLE_R * HOLE_R


def render(size, bg=None, ss=4):
    """ss = supersampling factor; 4 means 16 samples per pixel for smooth edges."""
    rows = []
    for py in range(size):
        row = []
        for px in range(size):
            pin = hole = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) / size
                    y = (py + (sy + 0.5) / ss) / size
                    if _inside(x, y):
                        pin += 1
                        if _hole(x, y):
                            hole += 1
            total = ss * ss
            cov = pin / total
            hcov = hole / total

            if bg is None:
                base, alpha = PIN, cov
            else:
                # Composite onto the solid background instead of using alpha.
                base = tuple(round(b + (p - b) * cov) for b, p in zip(bg, PIN))
                alpha = 1.0
            # Punch the hole by blending toward white over the pin body.
            colour = tuple(round(c + (h - c) * (hcov / cov if cov else 0))
                           for c, h in zip(base, HOLE)) if cov else base
            row.append((*colour, round(alpha * 255)))
        rows.append(row)
    return rows


def write_png(path, rows):
    size = len(rows)
    raw = b''.join(b'\x00' + bytes(v for px in row for v in px) for row in rows)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print(f'{path}  {size}x{size}  {len(png)}b')


SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M50 95 L{(CX - _TX) * 100:.1f} {_TY * 100:.1f} A{R * 100:.0f} {R * 100:.0f} 0 1 1 {(CX + _TX) * 100:.1f} {_TY * 100:.1f} Z"
        fill="#22c55e"/>
  <circle cx="50" cy="{CY * 100:.0f}" r="{HOLE_R * 100:.1f}" fill="#fff"/>
</svg>
'''

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), '..', 'public')
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'pin.svg'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(SVG)
    print('public/pin.svg')
    write_png(os.path.join(out, 'favicon-16x16.png'), render(16))
    write_png(os.path.join(out, 'favicon-32x32.png'), render(32))
    # iOS composites transparency onto black, so this one gets a solid tile.
    write_png(os.path.join(out, 'apple-touch-icon.png'), render(180, bg=NAVY))
