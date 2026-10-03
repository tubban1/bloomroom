import * as THREE from "three";

export const REFERENCE_STEM_HEIGHT = 70 / 28;
// Lowest point of the bloom, in the normalized source asset. Never cut a bloom.
const BLOOM_BASE: Record<string, number> = {
  amaryllis: 0.33,
  lotus: 0.72, "calla-lily": 0.54, carnation: 0.8,
  chrysanthemum: 0.65, snowdrop: 0.65, lavender: 0.6,
};

export function minimumStemHeight(kind: string, size = 1) {
  return Math.max(0.8, (1 - (BLOOM_BASE[kind] ?? 1)) * REFERENCE_STEM_HEIGHT * size + 0.08);
}

// Re-anchor the shortened trunk at the vase opening. All parts receive the same
// translation, so source leaves/pedicels cannot move independently of their branch.
export function stemCutAnchor(sources: THREE.BufferGeometry[], height: number, size: number) {
  const reference = REFERENCE_STEM_HEIGHT * size;
  const cutY = 1 - height / reference;
  if (cutY <= 0) return new THREE.Vector2();
  const intersections: THREE.Vector2[] = [];
  for (const source of sources) {
    source.computeBoundingBox();
    if ((source.boundingBox?.min.y ?? 1) > 0.003) continue;
    const p = source.getAttribute("position");
    const index = source.index;
    const count = index?.count ?? p.count;
    for (let i = 0; i < count; i += 3) {
      for (let j = 0; j < 3; j++) {
        const a = index ? index.getX(i + j) : i + j;
        const b = index ? index.getX(i + (j + 1) % 3) : i + (j + 1) % 3;
        const ay = p.getY(a), by = p.getY(b);
        if ((ay >= cutY) === (by >= cutY)) continue;
        const t = (cutY - ay) / (by - ay);
        intersections.push(new THREE.Vector2(
          p.getX(a) + (p.getX(b) - p.getX(a)) * t,
          p.getZ(a) + (p.getZ(b) - p.getZ(a)) * t,
        ));
      }
    }
  }
  if (!intersections.length) return new THREE.Vector2();
  const nearest = intersections.reduce((a, b) => a.lengthSq() < b.lengthSq() ? a : b);
  const section = intersections.filter((p) => p.distanceTo(nearest) < 0.012);
  return section.reduce((sum, p) => sum.add(p), new THREE.Vector2()).divideScalar(section.length).multiplyScalar(reference);
}

// Shortening a cut branch removes its bottom, instead of squashing its flowers.
// Lengthening extends only the lowest bare section; the entire upper branch is rigid.
export function resizeStemGeometry(source: THREE.BufferGeometry, height: number, size: number, anchor = new THREE.Vector2()) {
  const geometry = source.clone();
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const reference = REFERENCE_STEM_HEIGHT * size;
  const offset = height - reference;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    positions.setXYZ(i, positions.getX(i) * reference - anchor.x,
      y * reference + offset * (offset > 0 ? Math.min(1, Math.max(0, y / 0.08)) : 1),
      positions.getZ(i) * reference - anchor.y);
    if (normals && offset > 0 && y < 0.08) {
      const ny = normals.getY(i) / (1 + offset / (0.08 * reference));
      const nx = normals.getX(i), nz = normals.getZ(i);
      const length = Math.hypot(nx, ny, nz) || 1;
      normals.setXYZ(i, nx / length, ny / length, nz / length);
    }
  }
  positions.needsUpdate = true;
  if (normals) normals.needsUpdate = true;
  if (offset < 0) {
    // Clip triangles at the new cut end, interpolating UVs and normals along the edge.
    // This also cuts lower leaves naturally, without flattening them into a disk.
    const names = Object.keys(geometry.attributes);
    const attributes = names.map((name) => geometry.getAttribute(name));
    const offsets: number[] = [];
    let stride = 0;
    for (const attribute of attributes) { offsets.push(stride); stride += attribute.itemSize; }
    const positionOffset = offsets[names.indexOf("position")];
    const output = attributes.map(() => [] as number[]);
    const index = geometry.index;
    const count = index?.count ?? positions.count;
    const vertex = (i: number) => {
      const values: number[] = [];
      for (const attribute of attributes) {
        for (let j = 0; j < attribute.itemSize; j++) values.push(attribute.getComponent(i, j));
      }
      return values;
    };
    for (let i = 0; i < count; i += 3) {
      const triangle = [0, 1, 2].map((j) => vertex(index ? index.getX(i + j) : i + j));
      const polygon: number[][] = [];
      for (let j = 0; j < 3; j++) {
        const a = triangle[j], b = triangle[(j + 1) % 3];
        const ay = a[positionOffset + 1], by = b[positionOffset + 1];
        if (ay >= 0) polygon.push(a);
        if ((ay >= 0) !== (by >= 0)) {
          const t = ay / (ay - by);
          const edge = a.map((value, k) => value + (b[k] - value) * t);
          edge[positionOffset + 1] = 0;
          polygon.push(edge);
        }
      }
      for (let j = 1; j < polygon.length - 1; j++) {
        for (const v of [polygon[0], polygon[j], polygon[j + 1]]) {
          attributes.forEach((attribute, k) => {
            for (let n = 0; n < attribute.itemSize; n++) output[k].push(v[offsets[k] + n]);
          });
        }
      }
    }
    geometry.setIndex(null);
    names.forEach((name, i) => geometry.setAttribute(name, new THREE.Float32BufferAttribute(output[i], attributes[i].itemSize)));
    geometry.clearGroups();
    if (geometry.hasAttribute("normal")) geometry.normalizeNormals();
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
