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
GAP = 4      # two labels on one baseline need at least this much space between them


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


def text_boxes(root, src):
    """Estimated (left, right, baseline, size, content) for each single-line <text>.

    Widths are estimated from character count, so this finds labels that run into
    each other, not ones that merely sit close. Rotated or moved text is skipped.
    """
    sizes = {m.group(1): float(m.group(2))
             for m in re.finditer(r"\.([\w-]+)\s*\{[^}]*?font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px", src)}
    bold = set(re.findall(r"\.([\w-]+)\s*\{[^}]*?font:[^;}]*?(?:bold|[6-9]00)", src))
    parent = {c: p for p in root.iter() for c in p}
    out = []
    for t in root.iter(f"{NS}text"):
        e, moved = t, False
        while e is not None:
            moved = moved or bool(e.get("transform"))
            e = parent.get(e)
        content = " ".join("".join(t.itertext()).split())
        if moved or not content or any(c.get("x") or c.get("dy") for c in t):
            continue
        try:
            x, y = float(t.get("x")), float(t.get("y"))
        except (TypeError, ValueError):
            continue
        cls = (t.get("class") or "").split()
        size = float(t.get("font-size") or next((sizes[c] for c in cls if c in sizes), 12))
        w = len(content) * size * (0.58 if any(c in bold for c in cls) else 0.53)
        anchor = t.get("text-anchor", "start")
        left = x - w if anchor == "end" else x - w / 2 if anchor == "middle" else x
        out.append((left, left + w, y, size, content))
    return out


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

        # Labels that run into each other. Nothing above sees this: both labels are
        # real text, inside the viewBox, and no box overlaps.
        tb = sorted(text_boxes(root, src))
        hits = []
        for i, (l1, r1, y1, s1, c1) in enumerate(tb):
            for l2, r2, y2, s2, c2 in tb[i + 1:]:
                if l2 >= r1 + GAP:
                    break
                if abs(y1 - y2) < 0.5 * min(s1, s2):
                    hits.append(f'"{c1[:28]}" and "{c2[:28]}" near ({l2:.0f},{y1:.0f})')
        if hits:
            fails.append(f"text runs into text (under {GAP}px apart on one line): " + "; ".join(hits[:4])
                         + (f"; and {len(hits) - 4} more" if len(hits) > 4 else ""))
        seen, twice = set(), []
        for *_, c in tb:
            if len(c) >= 50 and c in seen and c not in twice:
                twice.append(c)
            seen.add(c)
        if twice:
            notes.append("the same sentence appears twice: " + "; ".join(f'"{c[:50]}"' for c in twice))

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
