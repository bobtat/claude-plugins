#!/usr/bin/env python3
"""Full-size (1:1) bending template, cut list and build order for a U-wire head (PDF).

Runs OUTSIDE Blender, with Python 3, numpy and reportlab (pip install numpy reportlab):
    python u_wire_template.py geometry.json head_template.pdf
geometry.json comes from u_wire.py's export_geometry() in Blender.
Page 1: the U-wire and the gallery at 1:1 for bending (with a 50 mm scale check) and at 4:1
to read. Page 2: key dimensions, cut list, build sequence, what the casting provides,
sources. Print at 100% ("Actual size") and measure the 50 mm line before trusting it.
"""
import json
import math
import os
import sys

import numpy as np
from reportlab.lib.colors import Color, black, white
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

GEOM = sys.argv[1] if len(sys.argv) > 1 else "geometry.json"
OUT_PDF = sys.argv[2] if len(sys.argv) > 2 else "head_template.pdf"
D = json.load(open(GEOM))

# ================================================================ geometry (mm, z = 0 at the girdle)
WD = D["wire_d"]
R = WD / 2
pr = D["params"]
u = np.array(pr["u"])
gal_t, gal_h = D["gallery_size"]          # gallery stock: thickness (plan) x height


def f(v):
    """a dimension with at least one and at most two decimals: 1.0, 0.6, 0.55"""
    t = f"{v:.2f}".rstrip("0")
    return t + "0" if t.endswith(".") else t


def bez_samples(spline, n=400):
    """spline = [[co, handle_left, handle_right], ...]; samples along the whole path (N x 3)"""
    pts = []
    for i in range(len(spline) - 1):
        p0, p1 = np.array(spline[i][0]), np.array(spline[i][2])
        p2, p3 = np.array(spline[i + 1][1]), np.array(spline[i + 1][0])
        t = np.linspace(0, 1, n, endpoint=(i == len(spline) - 2))[:, None]
        pts.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3)
    return np.vstack(pts)


def length(P):
    return float(np.sum(np.linalg.norm(np.diff(P, axis=0), axis=1)))


# ---------------- U-wire: true shape in its own plane (s along the diagonal, z up)
Wq = bez_samples(D["wire"][0])
s = Wq[:, 0] * u[0] + Wq[:, 1] * u[1]
U_half = np.c_[s, Wq[:, 2]]
U_full = np.vstack([np.c_[-U_half[::-1, 0], U_half[::-1, 1]], U_half[1:]])
u_wire_cad = 2 * (length(Wq) + R)                    # the rounded tips add half a wire at each end
beta = math.atan(pr["m"])
phi = math.pi / 2 - beta
arm_angle_deg = math.degrees(beta)
key_pts = {"bottom arc ends": (pr["Rb"] * math.sin(beta), pr["zc"] + pr["Rb"] * (1 - math.cos(beta))),
           "bend starts": (pr["sA"], pr["z_bend"])}
e_s = pr["sA"] - pr["Re"] * (1 - math.cos(phi))
key_pts["elbow ends"] = (e_s, key_pts["bottom arc ends"][1] + pr["m"] * (e_s - key_pts["bottom arc ends"][0]))
cross_angle = math.degrees(math.acos(-u[0] * u[0] + u[1] * u[1]))   # between the two diagonals
notch_width = WD / math.sin(math.radians(cross_angle))
bend_gap = D["gallery_z"][0] - pr["z_bend"]


def offset_polyline(P, d):
    """offset a 2D polyline by d along its left normal"""
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    return P + np.c_[-T[:, 1], T[:, 0]] * d


# ---------------- gallery loop (plan view), from the quarter path mirrored to four
Gq = bez_samples(D["gallery"][0], n=800)[:, :2]
loop = np.vstack([Gq, (Gq[::-1] * [-1, 1])[1:], (Gq * [-1, -1])[1:], (Gq[::-1] * [1, -1])[1:]])
prong = np.array([pr["sA"] * u[0], pr["sA"] * u[1]])
prongs = np.array([[sx * prong[0], sy * prong[1]] for sx in (1, -1) for sy in (1, -1)])
contact_x = float(np.max(np.abs(Gq[:, 0])))        # where the long-side bars cross the shoulders


def bar_lengths(offset):
    """lengths of the 4 bars on the loop offset by `offset` (outward +) between the prongs"""
    T = np.gradient(loop, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    P = loop + np.c_[T[:, 1], -T[:, 0]] * offset
    inside = np.zeros(len(P), bool)
    for c in prongs:
        inside |= np.linalg.norm(P - c, axis=1) < R
    runs, cur = [], []
    for i, ins in enumerate(inside):
        if not ins:
            cur.append(P[i])
        elif cur:
            runs.append(np.array(cur))
            cur = []
    if cur:
        if runs and not inside[0]:
            runs[0] = np.vstack([np.array(cur), runs[0]])
        else:
            runs.append(np.array(cur))
    return sorted([length(r) for r in runs])


cl_bars, out_bars = bar_lengths(0.0), bar_lengths(+gal_t / 2)
peg_below = (pr["zc"] - R) - D["peg"][0][1][0][2]     # from the wires' underside to the peg's end


# ================================================================ drawing
def _register_fonts():
    for reg, bold in (("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
                      (r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
                      ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
                      ("/Library/Fonts/Arial.ttf", "/Library/Fonts/Arial Bold.ttf")):
        if os.path.exists(reg) and os.path.exists(bold):
            pdfmetrics.registerFont(TTFont("Sans", reg))
            pdfmetrics.registerFont(TTFont("SansB", bold))
            return True
    return False


HAVE_TTF = _register_fonts()
GREY, LIGHT, GOLD = Color(0.45, 0.45, 0.45), Color(0.88, 0.88, 0.88), Color(0.78, 0.58, 0.15)
BLUE, RED = Color(0.20, 0.40, 0.75), Color(0.75, 0.10, 0.10)
METAL, PRONG = Color(0.98, 0.92, 0.78), Color(0.93, 0.80, 0.45)
c = canvas.Canvas(OUT_PDF, pagesize=letter, pageCompression=1)
c.setTitle(f"{D.get('title', 'Wire head')} - full-size template")
c.setAuthor("jewelcraft build-from-paths (Blender)")


def text(x, y, s_, size=8, font="Sans", color=black, anchor="l"):
    if not HAVE_TTF:     # the built-in fonts have no arrows, multiplication signs or degrees
        s_ = s_.replace("→", "->").replace("×", "x").replace("°", " deg").replace("—", "-")
        font = {"Sans": "Helvetica", "SansB": "Helvetica-Bold"}[font]
    c.setFillColor(color)
    c.setFont(font, size)
    {"l": c.drawString, "c": c.drawCentredString, "r": c.drawRightString}[anchor](x * mm, y * mm, s_)


def poly(P, ox, oy, sc, close=False, width=0.12, color=black, dash=None, fill=None):
    P = list(P)
    if len(P) > 60:
        P = P[::3] + [P[-1]]
    p = c.beginPath()
    p.moveTo((ox + P[0][0] * sc) * mm, (oy + P[0][1] * sc) * mm)
    for x, y in P[1:]:
        p.lineTo((ox + x * sc) * mm, (oy + y * sc) * mm)
    if close:
        p.close()
    c.setLineWidth(width * mm)
    c.setStrokeColor(color)
    c.setDash(*(dash or ([], 0)))
    if fill is not None:
        c.setFillColor(fill)
        c.drawPath(p, stroke=1, fill=1)
    else:
        c.drawPath(p, stroke=1, fill=0)
    c.setDash([], 0)


def leader(px, py, lx, ly, label, size=6.8):
    c.setStrokeColor(GREY)
    c.setLineWidth(0.08 * mm)
    c.line(px * mm, py * mm, lx * mm, (ly + 0.9) * mm)
    c.setFillColor(GREY)
    c.circle(px * mm, py * mm, 0.35 * mm, stroke=0, fill=1)
    text(lx + 0.8, ly, label, size)


def u_wire(ox, oy, sc, labels=False):
    """U-wire true shape; (ox, oy) = page position (mm) of the centre line at girdle level."""
    P = U_full
    zg0, zg1 = D["gallery_z"]
    xs = (P[:, 0].min() - 1.5, P[:, 0].max() + 1.5)
    c.setFillColor(LIGHT)
    c.rect((ox + xs[0] * sc) * mm, (oy + zg0 * sc) * mm, (xs[1] - xs[0]) * sc * mm, (zg1 - zg0) * sc * mm, stroke=0, fill=1)
    lines = [(0.0, BLUE)] + ([(D["band_top_centre_z"], GREY)] if "band_top_centre_z" in D else [])
    for z, col in lines:
        poly([(xs[0], z), (xs[1], z)], ox, oy, sc, width=0.08, color=col, dash=([0.8 * mm, 0.6 * mm], 0))
    poly(np.vstack([offset_polyline(P, +R), offset_polyline(P, -R)[::-1]]), ox, oy, sc, close=True,
         width=0.1 if sc < 2 else 0.15, fill=METAL)
    for sx in (-1, 1):                       # rounded wire ends at the prong tips
        c.setLineWidth(0.1 * mm)
        c.setStrokeColor(black)
        c.setFillColor(METAL)
        c.circle((ox + sx * pr["sA"] * sc) * mm, (oy + pr["T_z"] * sc) * mm, R * sc * mm, stroke=1, fill=1)
    poly(P, ox, oy, sc, width=0.05, color=GOLD, dash=([0.6 * mm, 0.4 * mm], 0))
    nw, zc = notch_width / 2, pr["zc"]
    poly([(-nw, zc + R), (-nw, zc), (nw, zc), (nw, zc + R)], ox, oy, sc, width=0.12, color=RED, fill=white)
    if not labels:
        return

    def X(s_):
        return ox + s_ * sc

    def Y(z_):
        return oy + z_ * sc
    lx = X(xs[1]) + 6
    s_b, z_b = key_pts["bend starts"]
    leader(X(s_b), Y(z_b), lx, Y(z_b) - 0.5, f"bend starts {abs(z_b):.2f} below the girdle")
    s_e, z_e = key_pts["elbow ends"]
    leader(X((s_b + s_e) / 2 + 0.25), Y((z_b + z_e) / 2), lx, Y((z_b + z_e) / 2) - 3.5, f"elbow, R{pr['Re']:.1f}")
    s_a, z_a = key_pts["bottom arc ends"]
    s_l = (s_a + s_e) / 2
    z_l = z_a + pr["m"] * (s_l - s_a)
    leader(X(s_l), Y(z_l) - R * sc, lx, Y(z_l) - 6.5, f"straight arm, {arm_angle_deg:.1f}° below horizontal")
    x_arc = min(0.45, 0.9 * s_a)
    leader(X(x_arc), Y(zc + pr['Rb'] * (1 - math.cos(math.asin(x_arc / pr['Rb'])))) - R * sc, lx, Y(zc) - 6.5,
           f"bottom arc, R{pr['Rb']:.1f}")
    text(X(xs[0]) - 1.5, Y(0.0) - 1, "girdle", 6.8, color=BLUE, anchor="r")
    text(X(xs[0]) - 1.5, Y((zg0 + zg1) / 2) - 1, "gallery bars", 6.8, color=GREY, anchor="r")
    if "band_top_centre_z" in D:
        text(X(xs[0]) - 1.5, Y(D["band_top_centre_z"]) - 1, "band top", 6.8, color=GREY, anchor="r")
    text(ox, Y(pr['T_z'] + R) + 2.5, f"prong centres {2 * pr['sA']:.2f} apart (along the diagonal)", 6.8, anchor="c")
    text(ox, Y(zc - R) - 4.5, f"crossing centre {abs(zc):.2f} below the girdle", 6.8, anchor="c")
    text(ox, Y(zc - R) - 8.0, f"half-lap notch {R:.2f} deep × {notch_width:.2f} wide — one U notched on top, "
         "the other underneath", 6.8, color=RED, anchor="c")


def gallery_plan(ox, oy, sc, labels=False):
    T = np.gradient(loop, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    Nout = np.c_[T[:, 1], -T[:, 0]]
    poly(loop + Nout * gal_t / 2, ox, oy, sc, close=True, width=0.1, fill=METAL)
    poly(loop - Nout * gal_t / 2, ox, oy, sc, close=True, width=0.1, fill=white)
    for sx in (1, -1):
        poly([(-sx * prong[0], -prong[1]), (sx * prong[0], prong[1])], ox, oy, sc, width=0.06, color=GOLD,
             dash=([0.6 * mm, 0.4 * mm], 0))
    for px, py in prongs:
        c.setLineWidth(0.1 * mm)
        c.setStrokeColor(black)
        c.setFillColor(PRONG)
        c.circle((ox + px * sc) * mm, (oy + py * sc) * mm, R * sc * mm, stroke=1, fill=1)
    hull = np.array(D["girdle_hull"] + [D["girdle_hull"][0]])
    poly(hull, ox, oy, sc, close=True, width=0.07, color=BLUE, dash=([0.8 * mm, 0.5 * mm], 0))
    if not labels:
        return
    x_out = contact_x + gal_t / 2 + 0.42        # label columns just outside the long-side bars
    y_out = float(np.max(np.abs(Gq[:, 1]))) + gal_t / 2
    if "shoulder_width" in D:                  # where the shoulders meet the long-side bars
        w = D["shoulder_width"]
        for sx in (1, -1):
            c.setStrokeColor(GREY)
            c.setLineWidth(0.08 * mm)
            c.setDash([0.5 * mm, 0.4 * mm], 0)
            c.rect((ox + (sx * contact_x - gal_t / 2) * sc) * mm, (oy - w / 2 * sc) * mm, gal_t * sc * mm, w * sc * mm,
                   stroke=1, fill=0)
            c.setDash([], 0)
        text(ox - x_out * sc, oy + 1.0, "shoulder", 6.8, color=GREY, anchor="r")
        text(ox - x_out * sc, oy - 2.5, "contact", 6.8, color=GREY, anchor="r")
    text(ox, oy + (y_out + 0.78) * sc, f"short-side bar ×2 — centre line {cl_bars[0]:.2f}, outer face {out_bars[0]:.2f}",
         6.8, anchor="c")
    text(ox + x_out * sc, oy + 1.0, "long-side bar ×2", 6.8)
    text(ox + x_out * sc, oy - 2.5, f"centre line {cl_bars[2]:.2f}", 6.8)
    text(ox + x_out * sc, oy - 6.0, f"outer face {out_bars[2]:.2f}", 6.8)
    text(ox, oy - (y_out + 0.58) * sc, f"U-wire planes cross at {cross_angle:.1f}°", 6.8, color=GOLD, anchor="c")
    text(ox, oy - (y_out + 0.58) * sc - 3.6, "dashed blue = the stone's girdle", 6.8, color=BLUE, anchor="c")


# ================= page 1: templates
title = D.get("title", "Wire head")
text(15, 265, f"{title} — full-size templates", 15, "SansB")
text(15, 259.5, "Print at 100% (\"Actual size\"). Lay the bent wire on the 1:1 drawings; the 4:1 drawings are for reading only.", 8.5)
c.setLineWidth(0.25 * mm)
c.setStrokeColor(black)
c.line(15 * mm, 252 * mm, 65 * mm, 252 * mm)
for i in range(0, 51, 10):
    c.line((15 + i) * mm, 250.8 * mm, (15 + i) * mm, 253.2 * mm)
text(67, 251.2, "scale check: this line must measure exactly 50 mm", 7.5)

text(15, 241, f"A. U-wire — make 2 (both the same shape), {f(WD)} mm round wire", 10, "SansB")
text(15, 234, "1:1", 8, "SansB")
u_wire(30, 224, 1.0)
text(72, 234, "4:1 (for reading)", 8, "SansB")
u_wire(112, 222, 4.0, labels=True)
text(15, 190, "Bend it flat, in one plane. Keep the prongs straight through the shaded band, where the gallery bars attach.", 7.5)

text(15, 180, f"B. Gallery — plan view, four bars running prong to prong, {f(gal_h)} mm tall × {f(gal_t)} mm stock", 10, "SansB")
text(15, 173, "1:1", 8, "SansB")
gallery_plan(30, 158, 1.0)
text(72, 173, "4:1 (for reading)", 8, "SansB")
gallery_plan(112, 140, 4.0, labels=True)
text(15, 104, f"Bend each bar on edge to the outline. File the ends concave with a round file so they wrap the {f(WD)} mm prongs;", 7.5)
text(15, 100.5, "the bars' outer faces finish flush with the outside of each prong.", 7.5)

PD = D.get("peg_d", WD)
text(15, 90, f"C. Peg — {f(PD)} mm round, soldered under the crossing", 10, "SansB")
text(15, 83, "1:1", 8, "SansB")
peg = np.array([(-PD / 2, 0), (PD / 2, 0), (PD / 2, -3.0), (-PD / 2, -3.0)])
poly(peg, 30, 80, 1.0, close=True, width=0.1, fill=METAL)
text(72, 83, "4:1", 8, "SansB")
poly(peg, 90, 80, 4.0, close=True, width=0.12, fill=METAL)
poly([(-1.6, -peg_below), (1.6, -peg_below)], 90, 80, 4.0, width=0.1, color=RED, dash=([0.8 * mm, 0.5 * mm], 0))
text(100, 77, f"cut 3 mm long; after soldering, trim so {peg_below:.1f} mm sticks out below the wires", 7.5)
text(100, 73.5, "(the red line) — that is the part that goes into the drilled hole", 7.5)

src = f"the Blender model {D['source']}" if D.get("source") else "the Blender model"
text(15, 30, f"From {src} ({', '.join(D.get('objects', []))}). Dimensions are nominal: hand-bent parts will", 7)
text(15, 26.5, "differ a little, which is why the casting leaves filing stock on the shoulder tops (page 2).", 7)
c.showPage()

# ================= page 2: dimensions, cut list, sequence
text(15, 265, f"{D.get('prefix', '')} — dimensions, cut list and build sequence".lstrip(" —"), 15, "SansB")
text(15, 255, "Key dimensions (mm; heights measured down from the stone's girdle plane)", 10, "SansB")
rows = [
    ("Prong centres", f"{2 * prong[0]:.2f} across × {2 * prong[1]:.2f} along the finger"),
    ("Gallery bars", f"{f(gal_h)} tall: top {abs(D['gallery_z'][1]):.2f} below the girdle, bottom {abs(D['gallery_z'][0]):.2f}"),
    ("Prong bend", f"starts {abs(pr['z_bend']):.2f} below the girdle ({bend_gap:.2f} under the gallery bars)"),
    ("Elbow", f"R{pr['Re']:.1f}; ends {abs(key_pts['elbow ends'][1]):.2f} down and {key_pts['elbow ends'][0]:.2f} from the centre"),
    ("Arm", f"straight, {arm_angle_deg:.1f}° below horizontal"),
    ("Bottom arc", f"R{pr['Rb']:.1f}; crossing centre {abs(pr['zc']):.2f} below the girdle, "
                   f"{D['culet_clearance']:.2f} under the culet"),
    ("Crossing", f"the two U-wires cross at {cross_angle:.1f}°; half-lap notch {R:.2f} deep × {notch_width:.2f} wide"),
]
y = 248.5
for k, v in rows:
    text(17, y, k, 7.8, "SansB")
    text(48, y, v, 7.8)
    y -= 4.6

y -= 5
alloy = f"{D['alloy']}; b" if D.get("alloy") else "B"
text(15, y, f"Cut list — {alloy}uy the wire in the same alloy as the casting if you can", 10, "SansB")
y -= 7
xs = [15, 52, 82, 92, 122, 136]
for x, h in zip(xs, ["Part", "Stock", "Qty", "CAD length", "Cut", "Notes"]):
    text(x, y, h, 8, "SansB")
c.setLineWidth(0.15 * mm)
c.line(15 * mm, (y - 1.8) * mm, 201 * mm, (y - 1.8) * mm)


def half_up(v):
    return math.ceil(v * 2) / 2


cut_u = half_up(u_wire_cad + 4.0)
bar_stock = f"{f(gal_h)} × {f(gal_t)} mm flat"
items = [
    ("U-wire", f"{f(WD)} mm round", "2", f"{u_wire_cad:.1f} tip to tip", f"{cut_u:.1f}", "+2 mm per prong, for the setter to trim"),
    ("Gallery bar, long", bar_stock, "2", f"{out_bars[2]:.2f} outer face", f"{half_up(out_bars[2] + 1):.1f}",
     f"file ends to fit (centre line {cl_bars[2]:.2f})"),
    ("Gallery bar, short", bar_stock, "2", f"{out_bars[0]:.2f} outer face", f"{half_up(out_bars[0] + 1):.1f}",
     f"file ends to fit (centre line {cl_bars[0]:.2f})"),
    ("Peg", f"{f(PD)} mm round", "1", f"{peg_below:.1f} below wires", "3.0", "trim to the depth of your hole"),
]
y -= 6.5
for row in items:
    for x, v in zip(xs, row):
        text(x, y, v, 7.6)
    y -= 5.2
text(15, y - 0.5, "Lengths in mm. Round wire bends about its centre line, so the centre-line length is what you cut.", 7.2)

y -= 12
text(15, y, "Build sequence", 10, "SansB")
y -= 6.5
steps = [
    "1  Anneal, then bend both U-wires on template A. Check them against the 1:1 drawing and against each other.",
    f"2  File the half-lap notches (one on top, one underneath) so the wires nest at {cross_angle:.0f}°. Check the crossing on template B.",
    "3  HARD solder: the crossing, and the peg under it.",
    "4  Bend the four gallery bars on template B and file their ends concave to fit the prongs.",
    f"5  MEDIUM solder: the bars to the prongs, with the bars' bottom edge {bend_gap:.2f} mm above the start of the prong bend.",
    "6  Fit to the casting. Drill the peg hole at the dimple, sizing the drill from your actual peg (Stuller: measure the peg,",
    "     choose the drill from that, never force it). Seat the head — peg in the hole, crossing in the grooves — then file",
    "     the shoulder tops until both gallery bars sit on them.",
    "7  EASY solder: head to casting in one heat (the crossing in its seat and both shoulders to the gallery). Heat the casting",
    "     and let the heat run into the head; flame on the head overheats the prongs and pulls solder up them (Stuller).",
    "8  Clean up and polish (inside the shoulders and under the head first), then the setter cuts the notches and sets the stone.",
    "    Solder order hard → medium → easy follows Simon's wire crown, which also builds four prongs from two crossed U-wires.",
]
for s_ in steps:
    text(17, y, s_, 7.6)
    y -= 4.7

y -= 4
text(15, y, "What the casting gives you", 10, "SansB")
y -= 6.5
cast_rows = []
if "band_top_centre_z" in D:
    depth_c = D["band_top_centre_z"] - pr["zc"] + R + D["seat_gap"]
    cast_rows.append(("Seat grooves", f"the wires' paths cut into the band top with {f(D['seat_gap'])} mm clearance, "
                                      f"{depth_c:.2f} mm deep at the centre"))
cast_rows += [
    ("Drill dimple", f"Ø{f(D['dimple_d'])} × {f(D['dimple_depth'])} mm at the centre of the crossing, to start the peg hole"),
    ("Shoulder tops", f"cut flat {f(D['allowance'])} mm above the gallery's underside — filing stock to fit your head"),
]
b = D.get("band")
if b and b.get("inside_diameter"):
    kind = f"{b['profile']} " if b.get("profile") else ""
    thick = f" × {f(b['thickness_at_top'])}" if b.get("thickness_at_top") else ""
    inside = f"{b['inside_diameter']:.2f} mm inside"
    size = f", {b['size']} ({inside})" if b.get("size") else f", {inside}"
    cast_rows.append(("Band", f"{kind}{f(b['width'])}{thick} mm{size}"))
for k, v in cast_rows:
    text(17, y, k, 7.6, "SansB")
    text(45, y, v, 7.6)
    y -= 4.7

y -= 4
text(15, y, "Sources", 10, "SansB")
y -= 6
for s_ in ["Stuller BenchJeweler, \"Three Techniques for Mounting the Peg Head Style\" (Shawn Albert); Stuller, \"Mounting the Peg Style Head\".",
           "Ganoksin, \"A Crowning Achievement Part 1\" (Bradney W. Simon): four prongs from two U-shaped wires; hard/medium/easy order."]:
    text(17, y, s_, 7.2)
    y -= 4.5
c.showPage()
c.save()
print("wrote", OUT_PDF, "cut_u", cut_u, "bars", half_up(out_bars[2] + 1), half_up(out_bars[0] + 1))
