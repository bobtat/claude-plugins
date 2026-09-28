# Studio materials and lighting: where the values come from

Tags as in the rest of the plugin: **[verified]** measured in Blender, **[cited]** from a
named source, **[derived]** calculated from a cited value, **[guidance]** a judgement.

## 18K yellow gold

- ISO 8654 (adopted in Europe as EN 28654) names gold colours by chromaticity, not by
  alloy composition. Colour **3N, "yellow"**: CIE 1931 x = 0.3601, y = 0.3729,
  reflectance ρ = 0.79, measured under D65 with an integrating-sphere spectrophotometer.
  Neighbours: 1N pale yellow (0.3526, 0.3700, 0.82), 2N light yellow (0.3590, 0.3766,
  0.82), 4N pink, 5N red. [cited: ProGold, "The colours of the gold alloys", Table 1,
  https://old.progold.com/PG_Resources/PG_Documents/Innovation/AIM2004A_GB.pdf]
- xyY → XYZ → linear sRGB (D65) gives **(0.9758, 0.7661, 0.4793)** for 3N, used as the
  Principled BSDF base colour with Metallic 1. 1N → (0.9653, 0.8065, 0.5261),
  2N → (0.9855, 0.8046, 0.4848). [derived]
- For comparison, pure gold is listed as linear sRGB (1.059, 0.773, 0.307): 18K yellow
  is paler and less saturated, as expected. [cited: https://physicallybased.info/]
- A metal's Principled base colour is its colour at normal incidence (F82-tint Fresnel),
  while ρ above is a diffuse-geometry measurement, so this is an approximation. [guidance]
- Roughness 0.12 for a polished finish. [guidance]
- Blender's Metallic BSDF can take per-channel complex IOR (Physical Conductor) instead,
  but published n, k values are for pure metals, not 18K alloys (for example gold
  n = 0.183, 0.421, 1.373; k = 3.424, 2.346, 1.770 at 650/550/450 nm). [cited:
  https://chris.hindefjord.se/resources/rgb-ior-metals/, from RefractiveIndex.INFO;
  https://projects.blender.org/blender/blender/pulls/114958]

## Diamond

- IOR 2.417. [cited: https://physicallybased.info/] Abbe number about 55.3 for
  dispersion. [cited: https://www.migenius.com/articles/mdl-diamonds/]
- Blender 5.1.1's Principled BSDF has no dispersion input. [verified] Native dispersion
  is coming in Blender 5.3 (in alpha as of September 2026). [cited:
  https://80.lv/articles/understanding-native-dispersion-in-blender-5-3] The script
  reports `dispersion: false` until the input exists.
- Transmission Weight 1, roughness 0; Cycles bounces raised to glossy 16, transmission
  32, total 32, so the stone doesn't render dark. [guidance]

## Lighting

- The HDRIs are Blender's bundled studio lights (`datafiles/studiolights/world`: city,
  courtyard, forest, interior, night, studio, sunrise, sunset), so nothing is
  downloaded. [verified]
- `studio.exr` measured mean linear RGB (0.466, 0.553, 0.620): blue-tinted, B/R ≈ 1.33.
  Rendered through it, the gold's mean B/R was about 0.82–0.86 whatever the light power.
  With the HDRI desaturated (Hue/Saturation node, saturation 0), it was 0.79–0.81,
  against about 0.72 expected for 3N under white light in sRGB. [verified]
- The camera sees a plain grey backdrop (Light Path "Is Camera Ray"), while reflections
  and lighting come from the HDRI. [verified]
- Three disk area lights (key, fill, top) are placed 8 × the piece's radius away and
  5 × its radius across, with power = `light_k` × relative strength × distance², so
  exposure doesn't change with the piece's size. `light_k` 30 and HDRI strength 2.5 kept
  clipped highlights on the band to about 2.5% of its pixels. [verified on one test ring]
- "Standard" view transform keeps the gold's colour closer to its material value; AgX
  softens highlights but also desaturates the gold slightly. Standard is the default.
  [verified by side-by-side render]

## Cameras

- 100 mm lens (36 mm sensor) for the perspective views, for low distortion. [guidance]
- Perspective distance is the closest at which every bounding-box corner (for the head
  views, the gems' box enlarged 1.5×) fits in the square frame with a 15% margin.
  Orthographic scale fits the whole piece with the same margin. [verified]
