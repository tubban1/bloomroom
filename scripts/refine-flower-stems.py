"""Remove source foliage from flowering cut stems without changing bloom scale.

Input must contain the freshly prepared, unrefined GLBs. Keep foliage as its
own catalog item; flower stems retain their natural blossom and peduncle.
"""
from asset_geometry import load, components, export, render
from pathlib import Path
import json
import sys
import numpy as np

source = Path(sys.argv[1])
dest = Path(sys.argv[2])
units = json.loads((dest / 'units.json').read_text())
audit = Path('/tmp/bloomroom-assets/refined')
audit.mkdir(parents=True, exist_ok=True)


def subset(part, ids):
    result = dict(part)
    result['faces'] = part['faces'][ids]
    return result


for name in ('carnation', 'chrysanthemum', 'snowdrop'):
    parts = load(source / f'{name}.glb')
    if name == 'carnation':
        # Separate material for the two side leaves; retain stalk and bloom.
        parts = [part for part in parts if part['material'].get('name') != 'Material_9.003']
    elif name == 'snowdrop':
        # Components 2-7 are the long basal leaves. The first two form the
        # peduncle, and the remaining components form the hanging bell.
        part = parts[0]
        selected = [entry[0] for index, entry in enumerate(components(part)) if index < 2 or index > 7]
        parts = [subset(part, np.concatenate(selected))]
    else:
        # The scan has detached, leaf-shaped polygon components with muted
        # green texture; retain its woody stems and all yellow bloom pieces.
        part = parts[0]
        selected = []
        for index, (ids, _, _, _) in enumerate(components(part)):
            if index < 8 and index != 3:
                selected.append(ids)
                continue
            uv = part['attrs']['TEXCOORD_0'][part['faces'][ids]].mean(axis=1)
            image = part['texture']
            rgb = image[
                (np.mod(uv[:, 1], 1) * (len(image) - 1)).astype(int),
                (np.mod(uv[:, 0], 1) * (image.shape[1] - 1)).astype(int),
                :3,
            ].mean(axis=0)
            if rgb[0] > 170 and rgb[1] > 155 and rgb[2] < 170:
                selected.append(ids)
        parts = [subset(part, np.concatenate(selected))]

    initial = np.concatenate([part['attrs']['POSITION'][np.unique(part['faces'])] for part in parts])
    floor, tip = initial[:, 1].min(), initial[:, 1].max()
    for part in parts:
        part['attrs']['POSITION'][:, 1] = (part['attrs']['POSITION'][:, 1] - floor) / (tip - floor)
    export(parts, dest / f'{name}.glb')
    points = np.concatenate([part['attrs']['POSITION'][np.unique(part['faces'])] for part in parts])
    low, high = points.min(axis=0), points.max(axis=0)
    units[name].update(
        height=float(high[1]),
        width=float(high[0] - low[0]),
        referenceWidthCm=float(max(high[0] - low[0], high[2] - low[2]) * 70),
        foliageRemoved=True,
    )
    render(parts, audit / f'{name}.png', name)
    print(f'{name}: {sum(len(part["faces"]) for part in parts)} triangles, foliage removed')

(dest / 'units.json').write_text(json.dumps(units, indent=2) + '\n')
