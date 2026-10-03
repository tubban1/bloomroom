import * as THREE from "three";
import { stemAxisRotation } from "./stem-shape";

// The scanned bare stalk has long triangles. Add horizontal sections before
// bending, otherwise moving only its end vertices still leaves a straight rod.
function subdivideStalk(geometry: THREE.BufferGeometry, height: number) {
  const names = Object.keys(geometry.attributes);
  const attributes = names.map(name => geometry.getAttribute(name));
  const offsets: number[] = [];
  let stride = 0;
  for (const attribute of attributes) { offsets.push(stride); stride += attribute.itemSize; }
  const yIndex = offsets[names.indexOf("position")] + 1;
  const index = geometry.index;
  const count = index?.count ?? attributes[0].count;
  const output = attributes.map(() => [] as number[]);
  const read = (i: number) => attributes.flatMap(attribute =>
    Array.from({ length: attribute.itemSize }, (_, j) => attribute.getComponent(i, j)));
  const clip = (polygon: number[][], y: number, above: boolean) => {
    const result: number[][] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const insideA = above ? a[yIndex] >= y : a[yIndex] <= y;
      const insideB = above ? b[yIndex] >= y : b[yIndex] <= y;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = (y - a[yIndex]) / (b[yIndex] - a[yIndex]);
        const edge = a.map((value, j) => value + (b[j] - value) * t);
        edge[yIndex] = y;
        result.push(edge);
      }
    }
    return result;
  };
  const step = Math.max(height, 0.01) / 32;
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map(j => read(index ? index.getX(i + j) : i + j));
    const low = Math.floor(Math.min(...triangle.map(p => p[yIndex])) / step);
    const high = Math.floor(Math.max(...triangle.map(p => p[yIndex])) / step);
    for (let band = low; band <= high; band++) {
      const polygon = clip(clip(triangle, band * step, true), (band + 1) * step, false);
      for (let j = 1; j < polygon.length - 1; j++) {
        for (const vertex of [polygon[0], polygon[j], polygon[j + 1]]) {
          attributes.forEach((attribute, k) => {
            for (let n = 0; n < attribute.itemSize; n++) output[k].push(vertex[offsets[k] + n]);
          });
        }
      }
    }
  }
  geometry.setIndex(null);
  names.forEach((name, i) => geometry.setAttribute(name, new THREE.Float32BufferAttribute(output[i], attributes[i].itemSize)));
}

export function softenIvyGeometry(geometry: THREE.BufferGeometry, height: number, leanX: number, leanZ: number, leaves: boolean) {
  if (!leaves) subdivideStalk(geometry, height);
  const position = geometry.getAttribute("position");
  const up = new THREE.Vector3(0, 1, 0);
  const inverseLean = stemAxisRotation(height, leanX, leanZ).invert();
  const down = new THREE.Vector3(0, -1, 0).applyQuaternion(inverseLean);
  // A small resting curl keeps the bend direction continuous near upright.
  // Gravity alone has no lateral direction at zero tilt and flips at its sign change.
  const pull = down.clone().add(new THREE.Vector3(0.22, 0, 0.08).applyQuaternion(inverseLean));
  const axis = up.clone().cross(pull);
  if (axis.lengthSq() < 1e-8) axis.set(0, 0, -1);
  else axis.normalize();
  const tilt = THREE.MathUtils.clamp(Math.hypot(leanX, leanZ) / Math.max(height, 0.01), 0, 1);
  const bend = Math.min(up.angleTo(down) * 0.85, 0.95 + tilt * 0.9);
  const frame = (u: number) => new THREE.Quaternion().setFromAxisAngle(axis, bend * u ** 1.25);
  const samples = [new THREE.Vector3()];
  for (let i = 1; i <= 64; i++) {
    samples.push(samples[i - 1].clone().add(up.clone().applyQuaternion(frame((i - 0.5) / 64)).multiplyScalar(height / 64)));
  }
  const mapPoint = (point: THREE.Vector3) => {
    const u = THREE.MathUtils.clamp(point.y / Math.max(height, 0.01), 0, 1);
    const step = u * 64, i = Math.min(63, Math.floor(step));
    return samples[i].clone().lerp(samples[i + 1], step - i)
      .add(new THREE.Vector3(point.x, 0, point.z).applyQuaternion(frame(u)));
  };
  if (leaves) {
    // Each disconnected leaf follows the branch as a rigid patch, without stretching.
    const parents = Array.from({ length: position.count }, (_, i) => i);
    const root = (i: number): number => parents[i] === i ? i : (parents[i] = root(parents[i]));
    const sharedCorners = new Map<string, number>();
    const source = geometry.getAttribute("botanicalSource") ?? position;
    for (let i = 0; i < position.count; i++) {
      const key = [source.getX(i), source.getY(i), source.getZ(i)].map(v => v.toFixed(5)).join(":");
      const previous = sharedCorners.get(key);
      if (previous !== undefined) parents[root(i)] = root(previous);
      else sharedCorners.set(key, i);
    }
    const index = geometry.index;
    const count = index?.count ?? position.count;
    for (let i = 0; i < count; i += 3) {
      const a = index ? index.getX(i) : i;
      for (let j = 1; j < 3; j++) {
        const b = index ? index.getX(i + j) : i + j;
        parents[root(b)] = root(a);
      }
    }
    const patches = new Map<number, number[]>();
    for (let i = 0; i < position.count; i++) {
      const id = root(i); const patch = patches.get(id) ?? [];
      patch.push(i); patches.set(id, patch);
    }
    for (const patch of patches.values()) {
      const center = patch.reduce((sum, i) => sum.add(new THREE.Vector3().fromBufferAttribute(position, i)), new THREE.Vector3()).divideScalar(patch.length);
      const mappedCenter = mapPoint(center);
      const rotation = frame(THREE.MathUtils.clamp(center.y / Math.max(height, 0.01), 0, 1));
      for (const i of patch) {
        const point = new THREE.Vector3().fromBufferAttribute(position, i).sub(center).applyQuaternion(rotation).add(mappedCenter);
        position.setXYZ(i, point.x, point.y, point.z);
      }
    }
  } else {
    for (let i = 0; i < position.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, i);
      const mapped = mapPoint(point); position.setXYZ(i, mapped.x, mapped.y, mapped.z);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
