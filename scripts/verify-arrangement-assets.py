"""Check the served cut units and their centimetre calibration."""
from asset_geometry import load
from pathlib import Path
import json
import numpy as np

root = Path(__file__).resolve().parents[1] / 'public' / 'models'
units = json.loads((root / 'units.json').read_text())
files = {path.stem: path for path in root.glob('*.glb')}
assert files.keys() == units.keys(), f'Manifest mismatch: {files.keys() ^ units.keys()}'
for name, path in sorted(files.items()):
    parts = load(path)
    assert parts, f'{name}: no mesh'
    positions = np.concatenate([part['attrs']['POSITION'][np.unique(part['faces'])] for part in parts])
    low = positions.min(axis=0)
    high = positions.max(axis=0)
    assert np.isfinite(positions).all(), f'{name}: invalid coordinates'
    assert abs(low[1] - units[name].get('minY', 0)) < .003, f'{name}: model floor differs from manifest ({low[1]})'
    assert abs(high[1] - units[name]['height']) < .003, f'{name}: manifest height differs'
    if units[name]['mode'] == 'stem':
        assert abs(low[1]) < .003, f'{name}: cut end not at zero ({low[1]})'
        assert abs(high[1] - 1) < .003, f'{name}: stem not one unit tall'
        assert abs(max(np.ptp(positions[:, 0]), np.ptp(positions[:, 2])) * 70 - units[name]['referenceWidthCm']) < .25, f'{name}: 70 cm stem span differs'
    else:
        assert units[name].get('minY', 0) > -.3, f'{name}: head extends too far below stem attachment'
        assert abs(np.ptp(positions[:, 0]) * 28 - units[name]['referenceWidthCm']) < .25, f'{name}: flower face diameter differs'
    assert units[name]['mode'] in ('head', 'stem')
    print(f'{name:23} {units[name]["mode"]:4} {len(parts):2} mesh(es)  {high[1]*28:.1f} cm')
print(f'Validated {len(files)} single-unit models.')
