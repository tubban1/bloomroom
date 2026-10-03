"""Remove stray foliage from head assets and place each cut-stem attachment.

Run after preparing/simplifying the Sketchfab assets. The input must be a fresh
copy of the unrefined public models; output may be the public model directory.
"""
from asset_geometry import load, components, export, render
from pathlib import Path
import json
import sys
import numpy as np

source = Path(sys.argv[1])
dest = Path(sys.argv[2])
dest.mkdir(parents=True, exist_ok=True)
units = json.loads((dest / 'units.json').read_text())
audit = Path('/tmp/bloomroom-assets/refined')
audit.mkdir(parents=True, exist_ok=True)


def keep_components(part, count):
    chosen = np.concatenate([entry[0] for entry in components(part)[:count]])
    result = dict(part)
    result['faces'] = part['faces'][chosen]
    return result


def keep_faces(part, predicate):
    centers = part['attrs']['POSITION'][part['faces']].mean(axis=1)
    result = dict(part)
    result['faces'] = part['faces'][predicate(centers)]
    return result


for name in ('hydrangea', 'tulip', 'lily', 'chamomile', 'daisy'):
    parts = load(source / f'{name}.glb')
    if name == 'hydrangea':
        # The scan's right-hand leaf is fused into the bloom mesh. Retain the
        # dome; the old 20 cm width included that leaf, so measure it anew.
        parts = [keep_faces(part, lambda p: (p[:, 0] < .025) & (p[:, 1] > .115)) for part in parts]
        diameter_cm = 18
    elif name == 'tulip':
        # Three petal shells and a fourth, disconnected leaf/wrapper.
        parts = [keep_components(part, 3) for part in parts]
        diameter_cm = 6
    elif name == 'lily':
        # Six petals plus center. Larger lower components are source leaves.
        parts = [keep_components(part, 7) for part in parts]
        diameter_cm = 14
    elif name == 'chamomile':
        # The scan includes a disconnected triangular leaf beneath the bloom.
        parts = [keep_components(part, len(components(part)) - 1) for part in parts]
        diameter_cm = 4.5
    else:
        # A small green source fragment protrudes from the daisy's right side.
        cleaned = []
        for part in parts:
            selected = [entry[0] for entry in components(part) if not (entry[2][2] < -.06 and entry[2][0] > .09)]
            cleaned.append(dict(part, faces=part['faces'][np.concatenate(selected)]))
        parts = cleaned
        diameter_cm = 8

    points = np.concatenate([part['attrs']['POSITION'][np.unique(part['faces'])] for part in parts])
    low, high = points.min(axis=0), points.max(axis=0)
    if name == 'lily':
        # Petal tips hang below the receptacle; the stalk enters the back of
        # the flower, rather than attaching to the lowest petal tip.
        anchor = np.array([.04, .15, -.06])
    else:
        anchor = np.array([(low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2])
    face_scale = (diameter_cm / 28) / (high[0] - low[0])
    for part in parts:
        part['attrs']['POSITION'] = (part['attrs']['POSITION'] - anchor) * face_scale
    export(parts, dest / f'{name}.glb')
    points = np.concatenate([part['attrs']['POSITION'][np.unique(part['faces'])] for part in parts])
    low, high = points.min(axis=0), points.max(axis=0)
    units[name].update(
        height=float(high[1]),
        width=float(high[0] - low[0]),
        referenceWidthCm=diameter_cm,
        minY=float(low[1]),
        attachment='receptacle' if name == 'lily' else 'base of bloom',
    )
    render(parts, audit / f'{name}.png', name)
    print(f'{name}: {sum(len(part["faces"]) for part in parts)} triangles, {diameter_cm} cm face, attachment y=0')

(dest / 'units.json').write_text(json.dumps(units, indent=2) + '\n')
