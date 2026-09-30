"""Extract and normalize a licensed GLB flower head, retaining only used textures.
Usage: python3 scripts/prepare-flower-models.py INPUT OUTPUT MESH_INDEX WIDTH [MIN_Z]
Optional sixth argument: y to identify Y-up source geometry.
Original downloaded assets are intentionally not shipped alongside optimized assets.
"""
import copy
import json
import math
import struct
import sys
from pathlib import Path

source, destination, mesh_index, width = sys.argv[1:5]
cut = float(sys.argv[5]) if len(sys.argv) > 5 else -math.inf
up = sys.argv[6] if len(sys.argv) > 6 else 'z'
raw = Path(source).read_bytes()
json_length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_length])
binary = raw[28 + json_length:]
out = {'asset': {'version': '2.0', 'generator': 'Bloomroom asset preparation'},
       'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'FlowerHead'}],
       'meshes': [{'primitives': []}], 'accessors': [], 'bufferViews': [], 'buffers': [],
       'materials': [], 'textures': [], 'images': [], 'samplers': doc.get('samplers', [])}
if doc.get('extensionsUsed'): out['extensionsUsed'] = doc['extensionsUsed']
blob = bytearray()
formats = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
dims = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def read_accessor(index):
    a = doc['accessors'][index]
    v = doc['bufferViews'][a['bufferView']]
    fmt = '<' + formats[a['componentType']] * dims[a['type']]
    stride = v.get('byteStride', struct.calcsize(fmt))
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from(fmt, binary, offset + i * stride) for i in range(a['count'])]

def add_view(data):
    while len(blob) % 4: blob.append(0)
    index = len(out['bufferViews'])
    out['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)})
    blob.extend(data)
    return index

def add_accessor(values, component, typ, position=False):
    fmt = '<' + formats[component] * dims[typ]
    view = add_view(b''.join(struct.pack(fmt, *v) for v in values))
    a = {'bufferView': view, 'componentType': component, 'type': typ, 'count': len(values)}
    if position:
        a['min'] = [min(v[i] for v in values) for i in range(3)]
        a['max'] = [max(v[i] for v in values) for i in range(3)]
    out['accessors'].append(a)
    return len(out['accessors']) - 1

texture_map = {}
def copy_texture(index):
    if index in texture_map: return texture_map[index]
    t = copy.deepcopy(doc['textures'][index])
    image = copy.deepcopy(doc['images'][t['source']])
    view = doc['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    image['bufferView'] = add_view(binary[start:start + view['byteLength']])
    t['source'] = len(out['images']); out['images'].append(image)
    texture_map[index] = len(out['textures']); out['textures'].append(t)
    return texture_map[index]

def remap_textures(value):
    if not isinstance(value, dict): return
    for key, child in value.items():
        if key.endswith('Texture') and isinstance(child, dict) and 'index' in child:
            child['index'] = copy_texture(child['index'])
        else: remap_textures(child)

primitives = doc['meshes'][int(mesh_index)]['primitives']
for primitive in primitives:
    attributes = {name: read_accessor(index) for name, index in primitive['attributes'].items() if name in ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0']}
    if up == 'y':
        for name in ['POSITION', 'NORMAL']:
            if name in attributes: attributes[name] = [(x, -z, y) for x,y,z in attributes[name]]
    positions = attributes['POSITION']
    indices = [v[0] for v in read_accessor(primitive['indices'])] if 'indices' in primitive else list(range(len(positions)))
    kept = [indices[i:i+3] for i in range(0, len(indices), 3) if all(positions[j][2] >= cut for j in indices[i:i+3])]
    used = sorted({i for triangle in kept for i in triangle})
    if not used: continue
    lo = [min(positions[j][i] for j in used) for i in range(3)]
    hi = [max(positions[j][i] for j in used) for i in range(3)]
    scale = float(width) / max(hi[0] - lo[0], hi[1] - lo[1])
    center = [(lo[i] + hi[i]) / 2 for i in range(3)]
    result = {'attributes': {}}
    for name, values in attributes.items():
        subset = [values[j] for j in used]
        if name == 'POSITION': subset = [((x-center[0])*scale, (z-lo[2])*scale, -(y-center[1])*scale) for x,y,z in subset]
        if name == 'NORMAL': subset = [(x,z,-y) for x,y,z in subset]
        original = doc['accessors'][primitive['attributes'][name]]
        ai = add_accessor(subset, original['componentType'], original['type'], name == 'POSITION')
        if original.get('normalized'): out['accessors'][ai]['normalized'] = True
        result['attributes'][name] = ai
    remap = {old: new for new, old in enumerate(used)}
    result['indices'] = add_accessor([(remap[i],) for tri in kept for i in tri], 5125, 'SCALAR')
    material = copy.deepcopy(doc['materials'][primitive['material']])
    legacy = material.get('extensions', {}).pop('KHR_materials_pbrSpecularGlossiness', None)
    if legacy:
        material['pbrMetallicRoughness'] = {'baseColorTexture': legacy['diffuseTexture'], 'metallicFactor': 0, 'roughnessFactor': 1-legacy.get('glossinessFactor', 0)}
    remap_textures(material)
    result['material'] = len(out['materials']); out['materials'].append(material)
    out['meshes'][0]['primitives'].append(result)
    print(f'{destination}: {len(used)} vertices, {len(kept)} triangles')
while len(blob) % 4: blob.append(0)
out['buffers'] = [{'byteLength': len(blob)}]
encoded = json.dumps(out, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
length = 12 + 8 + len(encoded) + 8 + len(blob)
Path(destination).write_bytes(struct.pack('<III', 0x46546c67, 2, length) + struct.pack('<II',len(encoded),0x4e4f534a) + encoded + struct.pack('<II',len(blob),0x004e4942) + blob)
print(f'{length:,} bytes')
