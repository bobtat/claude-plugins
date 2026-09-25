# Heads, baskets and cathedral settings

**No head-building workflow has been tested yet.** JewelCraft places stones, prongs and
cutters, but heads, galleries, cathedral arches and curved claws are ordinary Blender
modeling. This file gives the vocabulary, bench proportions and sources to build from. Tell
the user when a head you model is unverified, and measure it with the helpers (prong
grip, seat clearance, wall thickness).

## Anatomy

- **Head:** the whole structure holding the stone: prongs plus the supports that join
  them.
- **Gallery rails:** "horizontal metal rails beneath the stone's girdle that connect the
  prongs laterally, forming a continuous cage or cradle", spreading stress across the
  frame. (CaratYes)
- **Basket setting:** the stone sits in a low cradle of prongs and gallery rails.
- **Cathedral setting:** "curved metal arch[es] … that sweep upward from the ring's shank
  and meet the stone head at an elevated position". This raises the stone, but it snags
  more easily and needs a contoured wedding band. (CaratYes)
- **Crown setting:** Brepohl describes one made from "a cone of such a size that the stone
  fits part way into it", filed to symmetry, with 4, 6 or 8 prongs. The lower tips are
  "soldered onto a ring made of flattened wire", and prong seats are filed at an angle to
  fit the pavilion. Use tough alloys for diamond prongs. (Brepohl via Ganoksin)

## Starting proportions (one experienced jeweler's advice, not a standard)

David Phelps on the Ganoksin Orchid forum, for basket settings:
- Upper gallery: flat wire about 1.5–3 mm wide × 1 mm thick.
- Lower gallery: about 1.5 mm square or flat.
- Tapered prongs. Delicate work may use doubled or tripled fine prongs.
- "A single piece of 18 gauge wire looks pretty small next to a 10mm round stone, but a
  double gallery setting for that stone made from 18 gauge actually looks a little heavy
  when it's finished." **Wire looks thinner on screen than it will finished.**

Jo Haemer (same thread): scale commercial settings for standard stone sizes.

Firmer numbers by stone size (supplier head specifications) have not been gathered yet.

## Construction approaches seen in the sources

- **Jewelry CAD (Rhino/RhinoArtisan):** build the shank, then place the gem and build the
  basket from adjustable height, diameter and rail profiles. The detailed steps are in
  video.
- **Blender, no jewelry add-ons (Damien Rohrbach):** Bézier curves, mesh modeling and
  sculpting. A solitaire body of about 32 vertices was finished with Shrinkwrap,
  Solidify, Mirror, Bevel, Subdivision, Remesh and Smooth. He stresses that "you have to be
  a jeweler first".

## Sources

- Brepohl, *The Theory and Practice of Goldsmithing*, excerpt: https://www.ganoksin.com/article/brepohl-on-stone-settings/
- Ganoksin Orchid, "Wire size for basket settings": https://orchid.ganoksin.com/t/wire-size-for-basket-settings/54744
- CaratYes, setting architecture: https://caratyes.com/ring-styles-settings/setting-architecture
- RhinoArtisan solitaire tutorial: https://www.rhinoartisan.com/tutorials/timeless-jewels/solitaire-ring/
- BlenderNation, Damien Rohrbach: https://www.blendernation.com/2022/06/29/behind-the-scenes-making-3d-jewelry-in-blender/
