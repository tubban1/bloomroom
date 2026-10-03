import * as THREE from "three";
import { stemAxisRotation } from "./stem-shape";

export function softenIvyGeometry(geometry: THREE.BufferGeometry, height: number, leanX: number, leanZ: number, leaves: boolean) {
  const position = geometry.getAttribute("position");
  const down = new THREE.Vector3(0, -1, 0).applyQuaternion(stemAxisRotation(height, leanX, leanZ).invert());
  const offset = (point: THREE.Vector3) => {
    const u = THREE.MathUtils.clamp(point.y / Math.max(height, 0.01), 0, 1);
    return down.clone().multiplyScalar(height * 0.18 * u ** 2.5)
      .add(new THREE.Vector3(0, 0, height * 0.028 * Math.sin(u * Math.PI) * u));
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
      const displacement = offset(center);
      const tangent = new THREE.Vector3(0, 1, 0).add(offset(center.clone().add(new THREE.Vector3(0, 0.001, 0))).sub(displacement).multiplyScalar(1000)).normalize();
      const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      for (const i of patch) {
        const point = new THREE.Vector3().fromBufferAttribute(position, i).sub(center).applyQuaternion(rotation).add(center).add(displacement);
        position.setXYZ(i, point.x, point.y, point.z);
      }
    }
  } else {
    for (let i = 0; i < position.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, i);
      point.add(offset(point)); position.setXYZ(i, point.x, point.y, point.z);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
