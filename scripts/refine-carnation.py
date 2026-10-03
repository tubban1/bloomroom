"""Keep the downloaded carnation bloom/calyx as one rigid cut-flower head.

Input is the normalized full-stem backup, never the already refined asset.
"""
import json
import sys
from pathlib import Path
import numpy as np
from asset_geometry import load, export, render

root = Path(__file__).resolve().parents[1]
parts = load(Path(sys.argv[1]))
cut = 0.785
stalk = next(p for p in parts if p['material'].get('name') == 'Material_9.001')
points = stalk['attrs']['POSITION']
section = points[np.abs(points[:, 1] - cut) < 0.008]
anchor = np.array([section[:, 0].mean(), cut, section[:, 2].mean()])
retained = []
for part in parts:
    if part is stalk:
        part['faces'] = part['faces'][np.all(points[part['faces'], 1] >= cut, axis=1)]
    if len(part['faces']):
        retained.append(part)

# An 8 cm presentation diameter; preserve every petal's proportions.
bloom = next(p for p in retained if p['material'].get('name') == 'petal-red03')
extent = np.ptp(bloom['attrs']['POSITION'][np.unique(bloom['faces'])], axis=0)
scale = (8 / 28) / max(extent[0], extent[2])
for part in retained:
    part['attrs']['POSITION'] = (part['attrs']['POSITION'] - anchor) * scale
export(retained, root / 'public/models/carnation.glb')
vertices = np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in retained])
low, high = vertices.min(axis=0), vertices.max(axis=0)
path = root / 'public/models/units.json'
units = json.loads(path.read_text())
units['carnation'].update(mode='head', height=float(high[1]), width=float(high[0]-low[0]),
                         referenceWidthCm=8, sourceStemReplaced=True)
path.write_text(json.dumps(units, indent=2) + '\n')
render(retained, '/tmp/carnation-refined-head.png', 'Original bloom and calyx')
print('Carnation: original petals/calyx retained; normalized to 8 cm diameter.')
