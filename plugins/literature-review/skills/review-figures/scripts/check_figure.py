#!/usr/bin/env python3
"""Validate a review figure SVG. Standard library only.

    python3 check_figure.py figures/prisma-flow.svg

Exits non-zero if any check fails. These are the defects that survive a
"looks fine" reading: a structurally valid SVG can still be visually garbled,
and an arrow can point at nothing.
"""
import re, sys, argparse
import xml.etree.ElementTree as ET

NS = "{http://www.w3.org/2000/svg}"
TOL = 2.5


def rects(root, cls="bx"):
    out = []
    for e in root.findall(f".//{NS}rect"):
        if cls and e.get("class") != cls:
            continue
        try:
            out.append(tuple(float(e.get(k)) for k in ("x", "y", "width", "height")))
        except (TypeError, ValueError):
            pass
    return out


def overlaps(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return (min(ax + aw, bx + bw) - max(ax, bx) > 0.5
            and min(ay + ah, by + bh) - max(ay, by) > 0.5)


def on_any_edge(px, py, boxes, tol=TOL):
    for x, y, w, h in boxes:
        if x - tol <= px <= x + w + tol and (abs(py - y) <= tol or abs(py - (y + h)) <= tol):
            return True
        if y - tol <= py <= y + h + tol and (abs(px - x) <= tol or abs(px - (x + w)) <= tol):
            return True
    return False


def check(path):
    src = open(path, encoding="utf-8").read()
    fails, notes = [], []

    try:
        root = ET.fromstring(src)
    except ET.ParseError as e:
        return [f"not well-formed XML: {e}"], []

    vb = root.get("viewBox")
    if not vb:
        fails.append("no viewBox (the figure will not scale into a document column)")
        vbw = vbh = float("inf")
    else:
        _, _, vbw, vbh = (float(v) for v in vb.split())
    if root.get("width") or root.get("height"):
        notes.append("fixed width/height set; prefer viewBox alone so it scales")

    boxes = rects(root)
    notes.append(f"{len(boxes)} content boxes")

    bad = [(i, j) for i in range(len(boxes)) for j in range(i + 1, len(boxes))
           if overlaps(boxes[i], boxes[j])]
    if bad:
        fails.append(f"overlapping boxes: {bad}")

    # Arrow endpoints must land on a box edge. A segment aimed at a coordinate
    # rather than routed to a shape leaves an arrow hanging in white space, and
    # no overlap or clipping check sees it.
    arrows = [e for e in root.findall(f".//{NS}path") if e.get("class") == "ar"]
    notes.append(f"{len(arrows)} arrows")
    dangling = []
    for e in arrows:
        pts = [(float(a), float(b)) for a, b in re.findall(r"(-?[\d.]+)[, ]+(-?[\d.]+)", e.get("d", ""))]
        if not pts:
            continue
        for end, p in (("start", pts[0]), ("end", pts[-1])):
            if not on_any_edge(p[0], p[1], boxes):
                dangling.append(f"{end} at ({p[0]:.0f},{p[1]:.0f})")
    if dangling:
        fails.append("arrow endpoints not on any box edge: " + "; ".join(dangling))

    # Clipping
    for x, y, w, h in rects(root, cls=None):
        if x < -0.5 or y < -0.5 or x + w > vbw + 0.5 or y + h > vbh + 0.5:
            fails.append(f"rect outside viewBox at ({x:.0f},{y:.0f},{w:.0f},{h:.0f})")
            break
    texts = root.findall(f".//{NS}text")
    if not texts:
        fails.append("no <text> elements (text must not be outlined paths)")
    else:
        ys = [float(t.get("y")) for t in texts if t.get("y")]
        xs = [float(t.get("x")) for t in texts if t.get("x")]
        if ys and max(ys) > vbh + 0.5:
            fails.append(f"text clipped: lowest y {max(ys):.0f} exceeds viewBox height {vbh:.0f}")
        if xs and max(xs) > vbw + 0.5:
            fails.append(f"text clipped horizontally: max x {max(xs):.0f} exceeds {vbw:.0f}")
        notes.append(f"{len(texts)} real <text> elements")

    # Accessibility
    if root.get("role") != "img":
        fails.append('missing role="img"')
    title = root.find(f"{NS}title")
    desc = root.find(f"{NS}desc")
    if title is None or not (title.text or "").strip():
        fails.append("missing or empty <title>")
    if desc is None or not (desc.text or "").strip():
        fails.append("missing or empty <desc> (it carries the numbers for a screen reader)")
    elif not re.search(r"\d", desc.text):
        notes.append("<desc> contains no digits — it should state the figure's numbers")
    if not root.get("aria-labelledby"):
        notes.append('no aria-labelledby wiring title/desc')

    # Theming
    hard = re.findall(r'fill="(white|black|#fff{1,4}|#000{1,4})"', src, re.I)
    if hard:
        fails.append(f"theme-dependent fills on marks: {sorted(set(hard))} — "
                     "these vanish on one background")
    if "prefers-color-scheme" not in src:
        notes.append("no prefers-color-scheme block (optional, but cheap)")

    # Font size floor: below ~11px, a 96 DPI raster turns text to mush.
    for m in re.finditer(r"font:[^;}\"]*?(\d+(?:\.\d+)?)px", src):
        if float(m.group(1)) < 10.5:
            notes.append(f"font-size {m.group(1)}px is below the 11px floor for rasterization")
            break
    return fails, notes


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg", nargs="+")
    a = ap.parse_args()
    rc = 0
    for path in a.svg:
        fails, notes = check(path)
        print(f"\n{path}")
        for n in notes:
            print(f"  · {n}")
        if fails:
            rc = 1
            for f in fails:
                print(f"  ✗ {f}")
        else:
            print("  ✓ all checks pass")
    return rc


if __name__ == "__main__":
    sys.exit(main())
