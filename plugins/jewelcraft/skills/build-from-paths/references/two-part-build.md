# The two-part build: a cast shank and a hand-built wire head

The split the R1 ring uses, its object names, the U-wire head, and the bench sequence. Tags as
in the core skill: **[verified]** measured in Blender, **[cited]** from the sources at the end,
**[guidance]** a choice made for R1, not a standard.

## The split

- **Cast** (by an outside caster): the band and the shoulders as one piece, with
  - **seat grooves** where the head's wires will sit: the wire paths grown by a Seat Gap of
    0.05 mm [guidance];
  - a **drill-start dimple** under the centre of the crossing, for the peg hole;
  - **shoulder tops left 0.2 mm high** (Filing Allowance), to file down to the real head:
    hand-bent parts never match the model exactly [guidance].
- **Hand-built:** two U-wires that cross under the stone and make the four prongs; four gallery
  bars running prong to prong; a peg soldered under the crossing.
- **Joined:** the peg goes into a hole drilled at the dimple, then the head is soldered to the
  casting at the crossing and where the gallery sits on the shoulders. The peg only locates the
  head: "the peg is simply an indexing aid, and should not be used as a structural element"
  (Stuller) [cited], so the solder joints carry it.

Follow the user's own plan when they have one; R1's split came from the user.

## Object names

Every script finds objects by "<prefix> <role>"; R1 uses the prefix "R1".

| Object | Type | Role |
|---|---|---|
| Head Control | empty | At the centre of the girdle; parent of the gem and the head paths. z = 0 in head coordinates is the girdle plane |
| Gem | JewelCraft gem | The stone |
| Wire | Bézier path | One quarter of the U-wires, head coordinates, centre of the crossing → prong tip |
| Peg | Bézier path | From inside the crossing down to the peg's end |
| Gallery, Gallery Profile | path + 2D profile | The gallery's quarter path with a Bevel > Object profile (R1: 0.6 × 1.0 mm) and a Mirror modifier |
| Band, Size | mesh, curve | The band (R1: comfort fit 2.5 × 1.8 mm, US 8) and its size curve |
| Shoulders, Shoulder Profile | path + 2D profile | R1: a 2.5 × 1.0 mm rectangle swept along one shoulder path, mirrored; the path's top is hooked to the head control so the shoulders follow the head |
| Head Wire | mesh + `wire_head` group (modifier "Head") | The head solid |
| Casting | mesh + `casting` group (modifier "Casting") | The cast part, as cast |
| Ring | mesh + `fuse` group (modifier "Fuse") | The finished piece, for renders, size and weight |

## The U-wire head (`scripts/u_wire.py`)

Each U-wire runs prong → elbow → straight arm → arc under the culet → arm → elbow → prong:
straight runs and arcs only, so it can be bent on a printed template. The two cross under the
stone at twice the prong's angle from the long axis (R1: 70.4°).

`U["apply"](prefix, ...)` writes the quarter path and the peg from:

| Setting | R1 | Notes |
|---|---|---|
| `prong_xy`, `tip_z` | (2.972, 4.212), 0.475 | One prong's axis and the path's end, head coordinates. Kept from the current wire unless given |
| `wire_d` | 1.1 | Also set on the Head and Casting modifiers |
| `culet_clearance` | 0.30 | Gap between the top of the wire and the culet |
| `bottom_arc_r`, `elbow_r` | 2.0, 1.2 | Bend radii |
| `arm_angle_deg` | 23.75 | The straight arm, below horizontal |
| `peg_len` | 0.6 | Peg below the wires |

It warns when the prong bend would start less than 0.1 mm under the gallery (the bars must sit on
straight prong). Place the prongs for grip: `H["prong_report"](gem, head)` should read 30–50% of
the wire's thickness inside the girdle (R1: 0.36 mm of 1.1, 33%) [verified].

**The crossing:** R1 uses a half-lap: each U notched half its thickness, one on top, one
underneath [guidance]. Simon's wire crown instead saws through the bottom of the first U, spreads
it and inserts the second; "the two U-shapes should cross each other in the back" (Simon) [cited].

## Bench sequence (R1)

1. Anneal; bend both U-wires on the 1:1 template and check them against each other.
2. File the half-lap notches; check the crossing on the gallery template.
3. **Hard** solder: the crossing and the peg under it.
4. Bend the gallery bars; file their ends concave to fit the prongs.
5. **Medium** solder: the bars to the prongs.
6. Fit to the casting. File the peg's corners to an octagon, measure it across the flats in at
   least two directions and choose the drill from that; chamfer the hole lightly with a 45°
   bearing bur; don't force the head in: force "often results in a distorted or damaged head"
   (Stuller) [cited]. File the shoulder tops until the gallery sits on them.
7. **Easy** solder: head to casting in one heat. Heat the mounting, not the head, slowly and on
   and off; "it is very easy to overheat the prongs and damage the head", and heat on the head
   risks "forcing the solder to run up the prongs" (Stuller) [cited].
8. Clean up and polish; the setter cuts the notches and sets the stone.

The hard → medium → easy order is Simon's for his wire crown (hard for the bezel seams, medium
for the prongs, easy to attach the crown) [cited]. Easy is the lowest-melting grade (Corti) [cited].

Cut list allowances on R1's template [guidance]: U-wire = CAD length + 2 mm per prong for the
setter to trim; gallery bars + 1 mm on the outer face, filed to fit (both rounded up to the
next 0.5 mm); peg cut 3 mm and trimmed to the hole.

## Solder and safety

- Match the solder's caratage to the piece: "with few exceptions, gold solder alloys should be of
  the same caratage as the jewellery" (Corti) [cited].
- Avoid cadmium solders: "there is a serious toxicity problem with cadmium" (Corti) [cited].
- The solder's liquidus should be "at least 20°C below the solidus temperature of the carat
  golds being soldered"; a typical 18 ct yellow alloy melts at 855–875°C (Corti) [cited].
- Fumes: use lead-free and antimony-free solder and fluoride-free flux; put the soldering
  station and pickle pot close to where air leaves the room; use exhaust ventilation and
  respiratory protection to remove the smoke plume from soldering (WSDOH) [cited].
- Pickle: properly diluted sodium bisulfate; gloves, goggles and protective clothing; spent
  pickle is hazardous waste and can't go down the drain (WSDOH) [cited].

## What to ask the caster

Shrinkage, minimum wall and finishing allowance: see `jewelcraft:print-cast-check`, step 3.
R1's STLs are unscaled.

## The R1 example, checked [verified]

On the R1 file (Blender 5.2.2, voxel 0.03), with helpers 0.4.0:
- Casting 302.27 mm³, head 48.96 mm³, finished ring 350.21 mm³ (5.44 g in 18K yellow at
  15.53 g/cm³); each one piece.
- Stone vs head: four islands of 0.10 mm³, the prong seats (the setter cuts them). Stone vs
  casting: none. Head vs casting: the peg (0.57 mm³, drilled away) and the two shoulder tops
  (0.28 mm³ each, the filing stock).
- Prong grip 0.36 mm (33% of 1.10 mm) on all four; tips 1.02 mm above the girdle.
- US 8 (18.13 mm).
- Thin spots under 0.5 mm: none on the finished ring or the head. The casting alone has a small
  tongue of metal at each side of the band, between the two seat grooves as they spread out
  from the crossing (about 0.2 mm tall, tapering to a point toward the crossing); `thin_spots`
  reads its edges 1.3–1.4 r deep. It sits between the two wires once the head is in place; file
  it off before fitting if the caster flags it [guidance]. The shoulder-top corners read about
  0.9 r.

## Sources

- Shawn Albert, "Three Techniques for Mounting the Peg Head Style", Stuller BenchJeweler: https://www.stuller.com/benchjeweler/resources/bencharticles/view/three-techniques-for-mounting-the-peg-head-style/
- Stuller, "Mounting the Peg Style Head": https://www.stuller.com/articles/view/mounting-the-peg-style-head
- Bradney W. Simon, "A Crowning Achievement Part 1", Ganoksin: https://ganoksin.com/article/a-crowning-achievement-1
- Chris Corti, "Carat Gold Solders for Jewellery Making", Ganoksin: https://www.ganoksin.com/article/carat-gold-solders-jewellery-making/
- Washington State Department of Health, "Jewelry and Metalsmithing": https://doh.wa.gov/community-and-environment/contaminants/art-hazards/jewelry-and-metalsmithing
