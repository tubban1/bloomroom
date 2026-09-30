# Bloomroom flower assets

Third-party models ship under Creative Commons Attribution 4.0 or CC0 Public Domain.
The complete author attribution, original Sketchfab page, license, and Bloomroom
modifications are listed in `credits.json` and on the studio's linked `credits.html` page.

## Whole stems (complete flower + stem loaded as-is)

- `gerbera.glb`: Tom's Gerbera Daisies.
- `chrysanthemum.glb`: Korea Heritage Service's Chrysanthemum.
- `lily-of-the-valley.glb`: SBonser's Lily of the Valley.
- `fern.glb`: SanForge Studio's 3D Fern – 01.
- `eucalyptus.glb` and `eucalyptus-sprig.glb`: two branches from newmag2207's Eucalyptus.
- `sunflower.glb`: Polygonal Miniatures' Sunflower.
- `orchid.glb`: Rigsters' photogrammetry Orchid scan.
- `calla-lily.glb`: TIS's Kála – Calla Lily (Zantedeschia).
- `carnation.glb`: GardenBee's Single flower / Carnation.
- `lily.glb`: TahirNilin's Lilium.
- `lotus.glb`: floraZia.com's CC0 Indian Lotus (Nelumbo nucifera); photogrammetry.
- `anemone.glb`: Livin Vision's Anemone hybrida 'Honorine Jobert'; photogrammetry.
- `chamomile.glb`: Cosmic_dust's Chamomile.
- `delphinium.glb`: Marco van Ammers – Tazama's White Delphinium.
- `snowdrop.glb`: LOLIPOP's Snowdrop pack; one stem extracted.
- `lavender.glb`: Moons' Lavender vase; stems extracted.
- `ivy.glb`: LOLIPOP's Ivy pack (12 variations); one trailing vine extracted.
- `monstera.glb`: Shift4cube's Monstera Deliciosa Leaf.

The complete stems preserve the original flower heads, leaves, and natural stem
shape. Texture maps are resized to at most 1024 pixels per side where possible.
The runtime clones materials, converts them to non-metallic botanical surfaces,
and normalizes each model's vertical bounds and scale. Models load when first
used. While a model loads, its slot stays empty rather than displaying a
synthetic bloom.

## Flower heads (head-only models with procedural stems)

- `garden-rose.glb`: Heliona's Rose; extracted and normalized from the original.
- `tulip.glb`: Ra_in_coat's Tulip Flower; head cropped in its rest pose.
- `daisy.glb`: LOLIPOP's Daisy models pack; one optimized flower head and shared
  texture atlas retained.
- `poppy.glb`: Luna's Poppy Flower; original mesh hierarchy and texture retained.
- `peony.glb`: Terrie Simmons-Ehrhardt's photographic Peony scan.
- `hydrangea.glb`: Akiko_NAKAMURA's photographic hydrangea scan.

Every flower and foliage species shown in the picker uses a Sketchfab model. The
blue-poppy option is hidden because no suitable downloadable model was found; old
shared arrangements still load with the imported poppy model.

Original downloads, API credentials, and signed download URLs are not shipped.
