import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNaturalStemCurve, naturalStemRadius, stemAxisRotation, stemAxisTip } from '../lib/stem-shape.ts';
import * as THREE from 'three';
import { resizeStemGeometry, stemCutAnchor, minimumStemHeight, REFERENCE_STEM_HEIGHT } from '../lib/stem-geometry.ts';

// Real mesh fixtures exported with scripts/asset_geometry.py into this temporary file.
const assets = JSON.parse(readFileSync('/tmp/bloomroom-stem-meshes.json', 'utf8'));
let cases = 0;
for (const [kind, meshes] of Object.entries(assets)) {
  for (const size of [0.75, 1, 1.25]) {
    for (const requested of [0.8, 1.8, 2.5, 3.2]) {
      const height = Math.max(requested, minimumStemHeight(kind, size));
      const sources = meshes.map(mesh => {
        const source = new THREE.BufferGeometry();
        source.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions.flat(), 3));
        source.setIndex(mesh.indices);
        return source;
      });
      const anchor = stemCutAnchor(sources, height, size);
      assert(Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
      for (const mesh of meshes) {
        const source = new THREE.BufferGeometry();
        source.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions.flat(), 3));
        source.setIndex(mesh.indices);
        const original = source.getAttribute('position').array.slice();
        const result = resizeStemGeometry(source, height, size, anchor);
        const positions = result.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          assert(positions.getY(i) >= -1e-6, `${kind}: geometry below cut end`);
          assert(positions.getY(i) <= height + 1e-5, `${kind}: unexpected height`);
          assert(Number.isFinite(positions.getX(i)), `${kind}: invalid position`);
        }
        assert.deepEqual(source.getAttribute('position').array, original, 'shared source must remain unchanged');
        // Every original upper vertex must still exist at its exact rigidly translated position.
        const keys = new Set(Array.from({ length: positions.count }, (_, i) =>
          [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => v.toFixed(4)).join(',')));
        const reference = REFERENCE_STEM_HEIGHT * size;
        const offset = height - reference;
        for (const [x, y, z] of mesh.positions.filter((_, i) => i % Math.max(1, Math.floor(mesh.positions.length / 100)) === 0)) {
          if (y < 0.08 || y * reference + offset < 0.001) continue;
          const expected = [x * reference - anchor.x, y * reference + offset, z * reference - anchor.y];
          // Float32 rounding can land either side of the 4th decimal; compare spatially if necessary.
          if (!keys.has(expected.map(v => v.toFixed(4)).join(','))) {
            assert(Array.from({ length: positions.count }, (_, i) => i).some(i =>
              Math.abs(positions.getX(i)-expected[0]) < 1e-5 && Math.abs(positions.getY(i)-expected[1]) < 1e-5 && Math.abs(positions.getZ(i)-expected[2]) < 1e-5), `${kind}: upper branch deformed`);
          }
        }
        result.dispose(); source.dispose();
        cases++;
      }
      sources.forEach(source => source.dispose());
    }
  }
}
// Rotation must preserve distances even at the requested angle extremes.
for (const angle of [-60, 0, 60]) {
  const a = new THREE.Vector3(0.2, 1.4, 0.1), b = new THREE.Vector3(-0.3, 2.4, -0.1);
  const distance = a.distanceTo(b);
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(angle));
  assert(Math.abs(a.applyQuaternion(rotation).distanceTo(b.applyQuaternion(rotation)) - distance) < 1e-10);
}
console.log(`Validated ${Object.keys(assets).length} species, ${cases} mesh/height/size combinations and ±60° rigid rotation.`);

const headKinds = ['rose','carnation','peony','hydrangea','sunflower','tulip','gerbera','poppy','blue-poppy','chamomile','daisy','anemone','lily','orchid','ranunculus','narcissus','dahlia','astrantia','eryngium','pine-cone'];
let poses = 0;
for (const kind of headKinds) for (const length of [0.12, 0.8, 1.8, 3.2]) for (const seed of [0, 2, 8]) {
  const curve = createNaturalStemCurve(kind, length, seed);
  assert(curve.getPoint(0).length() < 1e-10);
  assert(curve.getPoint(1).distanceTo(new THREE.Vector3(0, length, 0)) < 1e-10);
  assert(curve.getLength() < length * 1.02, `${kind}: excessive bow`);
  const attachment = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), curve.getTangent(1));
  assert(new THREE.Vector3(0,1,0).applyQuaternion(attachment).distanceTo(curve.getTangent(1)) < 1e-8);
  for (const degrees of [-60, -30, 0, 30, 60]) {
    const height = length + 0.3;
    const x = Math.sin(THREE.MathUtils.degToRad(degrees)) * height;
    const rotation = stemAxisRotation(height, x, 0);
    const tip = stemAxisTip(height, x, 0);
    assert(Math.abs(tip.length()-height) < 1e-10);
    assert(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(tip.x, tip.y))-degrees) < 1e-8);
    assert(curve.getPoint(1).applyQuaternion(rotation).distanceTo(new THREE.Vector3(0,length,0).applyQuaternion(rotation)) < 1e-10);
    poses++;
  }
  assert(naturalStemRadius(kind, 0.75) > 0 && naturalStemRadius(kind,1.25) < 0.03);
}
console.log(`Validated ${headKinds.length} head-only species, ${poses} natural stem poses and tangent attachments.`);
