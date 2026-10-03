"""Export served full-stem meshes for verify-stem-resizing.mjs (requires numpy/Pillow)."""
import json
import sys
from pathlib import Path
from asset_geometry import load

root = Path(__file__).resolve().parents[1]
units = json.loads((root / 'public/models/units.json').read_text())
output = {}
for name, unit in units.items():
    if unit['mode'] != 'stem':
        continue
    output['seeded-eucalyptus' if name == 'eucalyptus-sprig' else name] = [
        {'positions': part['attrs']['POSITION'].tolist(), 'indices': part['faces'].flatten().tolist()}
        for part in load(root / 'public/models' / f'{name}.glb')
    ]
path = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/bloomroom-stem-meshes.json')
path.write_text(json.dumps(output))
print(f'Exported {len(output)} full-stem species to {path}')
