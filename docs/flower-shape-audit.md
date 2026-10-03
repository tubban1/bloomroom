# Flower shape audit · 2026-10-03

Whole-stem assets previously scaled Y to requested height while keeping X/Z fixed.
This distorted flowers and leaves whenever stem height or visual size changed.

The renderer now scales the source uniformly, extends only the lowest bare 8% when
lengthening, and clips the cut end when shortening. Upper petals, leaves and branch
connections retain their shape. Rotating a stem remains a rigid quaternion rotation.
Species with substantial flower heads have a minimum height to avoid cutting petals.
Every rendered stem owns its geometry; editing one never modifies the cached asset.

Lotus had an additional baked distortion: its source width/height ratio was reduced
from 0.70258 to 0.35714. Restoring the petal Y proportion (factor 0.50833) while
lengthening the bare stalk places the bloom base at normalized Y 0.72042. The full
asset remains normalized to Y 0..1. Its presentation scale is 0.8, giving a flower
width around 20 cm; this represents a large lotus, not every cultivar.

Delphinium uses a uniform 0.55 presentation scale (about 14.3 cm full spike breadth)
and is added high at the rear/side, with alternating sides for successive stems.
This is a narrower arrangement choice, not a claimed universal species dimension.

Chamomile retains the existing 4.5 cm asset calibration (about 5 cm with presentation
scale). This is already enlarged for readability: botanical descriptions commonly
give 1–3 cm for individual flower heads. The face tilts towards the viewer and the
natural texture retains its yellow center. The unrelated yellow-daisy color choice
was removed from chamomile.

Sources:
- https://atlasbotanico.umh.es/matricaria-chamomilla/ (15–25, occasionally 30 mm)
- https://www.rhs.org.uk/plants/delphinium (naturally tall flower spikes)

Verification:
- Export meshes: `python3 scripts/export-stem-fixtures.py`
- Check geometry with Node 24+: `node scripts/verify-stem-resizing.mjs`
- 13 full-stem species, 264 mesh/height/size combinations; source remains unchanged,
  upper geometry stays rigid, cut ends remain above zero, and ±60° rotation preserves distances.
- Browser check: lotus at minimum/maximum height and ±60°, mixed rose/delphinium/chamomile.
- ESLint, TypeScript and production build.

## Consistent natural inclination

Head-only assets now follow the same rigid inclination as scanned whole branches.
Their stems have subtle resting curves and species-specific presentation thickness,
independent of the angle slider. The bloom attaches to the curve tip and follows its
local tangent. Heights and dragging use the same full-stem axis, including at ±60°.
Increasing flower size cannot consume the entire stem: minimum height includes the
bloom and a short remaining stalk. These are visual presentation settings, not a
botanical simulation of stem stiffness.

Shortened scanned branches are re-anchored using the cut section of their source
trunk. The same translation applies to every mesh so leaves and pedicels stay joined.
The lowest bare section's normals are adjusted when lengthened for consistent light.
All upper flower/leaf shapes remain uniformly scaled and rigid.

Mobile views fit the actual bouquet breadth after large inclinations; framing pauses
while dragging. Desktop and mobile share the same geometry and angle logic.

Additional validation: 13 head-only variants (including the blue-poppy alias), 780
height/angle/resting-shape poses and tangent attachments; 264 full-stem combinations
also include cut-end anchoring. Browser checks cover short stems/125% blooms, ±60°,
dragging, 390 px mobile controls, and mobile framing. Production build and lint pass.
