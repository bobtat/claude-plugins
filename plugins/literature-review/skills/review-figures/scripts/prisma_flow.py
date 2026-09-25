#!/usr/bin/env python3
"""Render a PRISMA 2020 flow diagram as SVG from counts.

Reads JSON on stdin or from a file argument; writes SVG to stdout or --out.
Standard library only.

Labels follow the official CC BY 4.0 templates at prisma-statement.org
(Page MJ, et al. BMJ 2021;372:n71). Supplying `other_methods` selects the
two-column v2 template, which is what citation searching (snowballing) requires.

The arithmetic is checked before anything is drawn. A flow whose numbers do not
close is reported and not rendered, because drawing it would launder a data
error into a graphic.
"""
import json, sys, argparse

# Theme-independent mid-tones: legible on white and on dark. See references/figures.md.
INK = "#44506b"
MUTED = "#6b7488"
DARK = {"ink": "#9fb0d0", "muted": "#8f9ab4"}

BOX_W, GAP_X = 250, 32
PAD, LINE_H, FS = 9, 14, 11.5
CHARS_PER_LINE = 38


def wrap(text, width=CHARS_PER_LINE):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if len(trial) > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


class Box:
    def __init__(self, x, y, lines, w=BOX_W):
        self.x, self.y, self.w, self.lines = x, y, w, lines
        self.h = 2 * PAD + max(1, len(lines)) * LINE_H

    @property
    def cx(self): return self.x + self.w / 2

    @property
    def bottom(self): return self.y + self.h

    @property
    def right(self): return self.x + self.w

    @property
    def cy(self): return self.y + self.h / 2

    def svg(self):
        parts = [f'<rect class="bx" x="{self.x}" y="{self.y}" width="{self.w}" height="{self.h}" rx="2"/>']
        ty = self.y + PAD + FS
        for ln in self.lines:
            parts.append(f'<text class="t" x="{self.x + PAD}" y="{ty:.1f}">{esc(ln)}</text>')
            ty += LINE_H
        return "".join(parts)


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def n(v):
    return f"{v:,}"


def check_arithmetic(d):
    """Return a list of human-readable arithmetic failures."""
    errs = []
    ident = sum(d["databases"].values()) + sum(d.get("registers", {}).values())
    other = sum(d.get("other_methods", {}).values())
    removed = sum(d.get("removed_before_screening", {}).values())
    screened = d["screened"]
    if ident - removed != screened:
        errs.append(
            f"identified ({ident}) - removed before screening ({removed}) = {ident - removed}, "
            f"but 'screened' is {screened}")
    excl = d["excluded"] if isinstance(d["excluded"], int) else sum(d["excluded"].values())
    if screened - excl != d["sought"]:
        errs.append(
            f"screened ({screened}) - excluded ({excl}) = {screened - excl}, "
            f"but 'sought' is {d['sought']}")
    tot_sought = d["sought"] + (d.get("other_sought", 0) if other else 0)
    tot_nr = d["not_retrieved"] + (d.get("other_not_retrieved", 0) if other else 0)
    tot_assessed = d["assessed"] + (d.get("other_assessed", 0) if other else 0)
    if tot_sought - tot_nr != tot_assessed:
        errs.append(
            f"sought ({tot_sought}) - not retrieved ({tot_nr}) = {tot_sought - tot_nr}, "
            f"but 'assessed' totals {tot_assessed}")
    reasons = sum(d.get("excluded_with_reasons", {}).values())
    reasons += sum(d.get("other_excluded_with_reasons", {}).values())
    if tot_assessed - reasons != d["included_studies"]:
        errs.append(
            f"assessed ({tot_assessed}) - excluded with reasons ({reasons}) = "
            f"{tot_assessed - reasons}, but 'included_studies' is {d['included_studies']}")
    if other and "other_sought" not in d:
        errs.append("other_methods supplied without other_sought / other_assessed chain")
    return errs


def build(d):
    v2 = bool(d.get("other_methods"))
    colA_x, colAx_x = 54, 54 + BOX_W + GAP_X
    colB_x = colAx_x + BOX_W + GAP_X + 10
    colBx_x = colB_x + BOX_W + GAP_X
    width = (colBx_x + BOX_W + 12) if v2 else (colAx_x + BOX_W + 12)

    boxes, arrows, y = [], [], 62

    # --- Identification -------------------------------------------------
    src = ["Records identified from*:"]
    src += [f"  {k} (n = {n(v)})" for k, v in d["databases"].items()]
    src += [f"  {k} (n = {n(v)})" for k, v in d.get("registers", {}).items()]
    b_src = Box(colA_x, y, src)

    rem = d.get("removed_before_screening", {})
    rem_lines = ["Records removed before screening:"]
    for k, v in rem.items():
        rem_lines += [f"  {ln}" for ln in wrap(f"{k} (n = {n(v)})", 34)]
    b_rem = Box(colAx_x, y, rem_lines) if rem else None

    b_other = None
    if v2:
        ol = ["Records identified from:"]
        ol += [f"  {k} (n = {n(v)})" for k, v in d["other_methods"].items()]
        b_other = Box(colB_x, y, ol)

    ident_boxes = [b for b in (b_src, b_rem, b_other) if b]
    boxes += ident_boxes
    y = max(b.bottom for b in ident_boxes) + 30
    ident_bottom = y - 15

    # --- Screening ------------------------------------------------------
    scr_top = y
    b_scr = Box(colA_x, y, [f"Records screened (n = {n(d['screened'])})"])
    if isinstance(d["excluded"], dict):
        el = ["Records excluded**:"] + [f"  {k} (n = {n(v)})" for k, v in d["excluded"].items()]
    else:
        el = [f"Records excluded** (n = {n(d['excluded'])})"]
    b_exc = Box(colAx_x, y, el)
    boxes += [b_scr, b_exc]
    arrows.append([(b_src.cx, b_src.bottom), (b_src.cx, b_scr.y)])
    if b_rem:
        arrows.append([(b_src.right, b_src.cy), (b_rem.x, b_src.cy)])
    arrows.append([(b_scr.right, b_scr.cy), (b_exc.x, b_scr.cy)])
    y = max(b_scr.bottom, b_exc.bottom) + 26

    b_sought = Box(colA_x, y, [f"Reports sought for retrieval (n = {n(d['sought'])})"])
    b_nr = Box(colAx_x, y, [f"Reports not retrieved (n = {n(d['not_retrieved'])})"])
    boxes += [b_sought, b_nr]
    arrows += [[(b_scr.cx, b_scr.bottom), (b_scr.cx, b_sought.y)],
               [(b_sought.right, b_sought.cy), (b_nr.x, b_sought.cy)]]
    row_sought_y = y
    y = max(b_sought.bottom, b_nr.bottom) + 26

    b_ass = Box(colA_x, y, [f"Reports assessed for eligibility (n = {n(d['assessed'])})"])
    exr = d.get("excluded_with_reasons", {})
    exl = ["Reports excluded:"] + [f"  {k} (n = {n(v)})" for k, v in exr.items()]
    b_exr = Box(colAx_x, y, exl)
    boxes += [b_ass, b_exr]
    arrows += [[(b_sought.cx, b_sought.bottom), (b_sought.cx, b_ass.y)],
               [(b_ass.right, b_ass.cy), (b_exr.x, b_ass.cy)]]

    tails = [b_ass]
    if v2:
        b_os = Box(colB_x, row_sought_y, [f"Reports sought for retrieval (n = {n(d['other_sought'])})"])
        b_onr = Box(colBx_x, row_sought_y, [f"Reports not retrieved (n = {n(d['other_not_retrieved'])})"])
        b_oa = Box(colB_x, y, [f"Reports assessed for eligibility (n = {n(d['other_assessed'])})"])
        oexr = d.get("other_excluded_with_reasons", {})
        oel = ["Reports excluded:"] + [f"  {k} (n = {n(v)})" for k, v in oexr.items()]
        b_oex = Box(colBx_x, y, oel)
        boxes += [b_os, b_onr, b_oa, b_oex]
        arrows += [[(b_other.cx, b_other.bottom), (b_other.cx, b_os.y)],
                   [(b_os.right, b_os.cy), (b_onr.x, b_os.cy)],
                   [(b_os.cx, b_os.bottom), (b_os.cx, b_oa.y)],
                   [(b_oa.right, b_oa.cy), (b_oex.x, b_oa.cy)]]
        tails.append(b_oa)
    screen_bottom = max(b.bottom for b in boxes) + 14
    # Clear every box drawn so far, not just the assessed ones: a tall
    # "Reports excluded" box beside them extends lower, and the Included box is
    # wider than a column, so keying off the tails alone collides with it.
    y = max(b.bottom for b in boxes) + 34

    # --- Included -------------------------------------------------------
    inc = [f"Studies included in review (n = {n(d['included_studies'])})"]
    if "included_reports" in d:
        inc.append(f"Reports of included studies (n = {n(d['included_reports'])})")
    b_inc = Box(colA_x, y, inc, w=BOX_W + 60)
    boxes.append(b_inc)
    # The main column drops straight into the top of the Included box. The
    # other-methods column is far to the right of it, so it turns a corner and
    # enters the right-hand edge: aiming a single segment at the box's y left the
    # arrow hanging in empty space, which no geometry check catches.
    arrows.append([(b_ass.cx, b_ass.bottom), (b_ass.cx, b_inc.y)])
    for tb in tails[1:]:
        arrows.append([(tb.cx, tb.bottom), (tb.cx, b_inc.cy), (b_inc.right, b_inc.cy)])
    inc_top = y
    height = b_inc.bottom + 74

    return dict(v2=v2, width=width, height=height, boxes=boxes, arrows=arrows,
                bands=[("Identification", 62, ident_bottom),
                       ("Screening", scr_top, screen_bottom),
                       ("Included", inc_top, b_inc.bottom)],
                headers=[("Identification of studies via databases and registers",
                          colA_x, colAx_x + BOX_W)] +
                        ([("Identification of studies via other methods",
                           colB_x, colBx_x + BOX_W)] if v2 else []),
                inc_bottom=b_inc.bottom)


def render(d, layout):
    W, H = layout["width"], layout["height"]
    ident = sum(d["databases"].values()) + sum(d.get("registers", {}).values())
    other = sum(d.get("other_methods", {}).values())
    desc = (f"PRISMA 2020 flow. {ident} records identified from databases and registers"
            + (f" and {other} from other methods" if other else "")
            + f"; {d['screened']} screened; {d['included_studies']} studies included.")
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" '
         f'role="img" aria-labelledby="ttl dsc">',
         f'<title id="ttl">PRISMA 2020 flow diagram</title>',
         f'<desc id="dsc">{esc(desc)}</desc>',
         '<style>'
         f'.bx{{fill:none;stroke:{INK};stroke-width:1.2}}'
         f'.t{{font:{FS}px system-ui,-apple-system,Segoe UI,sans-serif;fill:{INK}}}'
         f'.hd{{font:600 12px system-ui,sans-serif;fill:{INK}}}'
         f'.bandbx{{fill:none;stroke:{MUTED};stroke-width:1}}'
         f'.band{{font:600 11px system-ui,sans-serif;fill:{MUTED}}}'
         f'.ar{{stroke:{INK};stroke-width:1.2;fill:none;marker-end:url(#a)}}'
         f'.fn{{font:11px system-ui,sans-serif;fill:{MUTED}}}'
         '@media (prefers-color-scheme: dark){'
         f'.bx{{stroke:{DARK["ink"]}}}.t,.hd{{fill:{DARK["ink"]}}}'
         f'.bandbx{{stroke:{DARK["muted"]}}}.band,.fn{{fill:{DARK["muted"]}}}'
         f'.ar{{stroke:{DARK["ink"]}}}#ah{{fill:{DARK["ink"]}}}}}'
         '</style>',
         f'<defs><marker id="a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" '
         f'markerHeight="6" orient="auto"><path id="ah" d="M0 0 L8 4 L0 8 z" fill="{INK}"/>'
         '</marker></defs>']
    for label, x0, x1 in layout["headers"]:
        p.append(f'<text class="hd" x="{(x0 + x1) / 2:.0f}" y="42" text-anchor="middle">{esc(label)}</text>')
    for label, y0, y1 in layout["bands"]:
        p.append(f'<rect class="bandbx" x="10" y="{y0:.0f}" width="26" height="{max(y1 - y0, 20):.0f}" rx="2"/>')
        cy = (y0 + y1) / 2
        p.append(f'<text class="band" x="23" y="{cy:.0f}" text-anchor="middle" '
                 f'transform="rotate(-90 23 {cy:.0f})">{esc(label)}</text>')
    for pts in layout["arrows"]:
        d_ = "M" + " L".join(f"{x:.0f} {y:.0f}" for x, y in pts)
        p.append(f'<path class="ar" d="{d_}"/>')
    for b in layout["boxes"]:
        p.append(b.svg())
    fy = layout["inc_bottom"] + 26
    for fn in ["*  Consider, if feasible, reporting the number of records identified from each "
               "database or register searched, rather than the total across all of them.",
               "** If automation tools were used, indicate how many records were excluded by a "
               "human and how many were excluded by automation tools."]:
        for ln in wrap(fn, 110):
            p.append(f'<text class="fn" x="54" y="{fy:.0f}">{esc(ln)}</text>')
            fy += 13
    p.append("</svg>")
    return "\n".join(p)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("data", nargs="?", help="JSON file; omit to read stdin")
    ap.add_argument("--out", help="write SVG here instead of stdout")
    ap.add_argument("--force", action="store_true",
                    help="render even if the arithmetic does not close (records the failure in the desc)")
    a = ap.parse_args()
    d = json.load(open(a.data) if a.data else sys.stdin)

    errs = check_arithmetic(d)
    if errs and not a.force:
        print("PRISMA flow arithmetic does not close:", file=sys.stderr)
        for e in errs:
            print(f"  - {e}", file=sys.stderr)
        print("\nFigure not drawn. Fix the counts, or re-run with --force to render anyway.",
              file=sys.stderr)
        return 2
    svg = render(d, build(d))
    if a.out:
        open(a.out, "w").write(svg)
        print(f"wrote {a.out} ({len(svg)} bytes)" + (" WITH UNCLOSED ARITHMETIC" if errs else ""))
    else:
        sys.stdout.write(svg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
