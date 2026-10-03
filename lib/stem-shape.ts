import * as THREE from "three";

// Restrained presentation curves for head-only assets. These describe the resting
// stem, independently of the user's inclination; scanned branches keep their own shape.
const STEM_PROFILES: Record<string, { bow: number; radius: number }> = {
  ranunculus: { bow: 0.025, radius: 0.013 },
  narcissus: { bow: 0.03, radius: 0.01 },
  dahlia: { bow: 0.025, radius: 0.018 },
  astrantia: { bow: 0.04, radius: 0.006 },
  eryngium: { bow: 0.02, radius: 0.011 },
  "pine-cone": { bow: 0.02, radius: 0.016 },
  rose: { bow: 0.025, radius: 0.014 },
  carnation: { bow: 0.018, radius: 0.009 },
  peony: { bow: 0.022, radius: 0.018 },
  hydrangea: { bow: 0.018, radius: 0.02 },
  sunflower: { bow: 0.018, radius: 0.023 },
  tulip: { bow: 0.045, radius: 0.017 },
  gerbera: { bow: 0.035, radius: 0.013 },
  poppy: { bow: 0.055, radius: 0.009 },
  "blue-poppy": { bow: 0.055, radius: 0.009 },
  chamomile: { bow: 0.045, radius: 0.006 },
  daisy: { bow: 0.04, radius: 0.008 },
  anemone: { bow: 0.035, radius: 0.009 },
  lily: { bow: 0.025, radius: 0.015 },
  orchid: { bow: 0.035, radius: 0.012 },
};

export function naturalStemRadius(kind: string, size: number) {
  return (STEM_PROFILES[kind]?.radius ?? 0.014) * Math.sqrt(size);
}

export function createNaturalStemCurve(kind: string, length: number, seed: number) {
  const bow = (STEM_PROFILES[kind]?.bow ?? 0.025) * length;
  const direction = seed * 1.73;
  const x = Math.cos(direction) * bow;
  const z = Math.sin(direction) * bow * 0.45;
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(),
    new THREE.Vector3(x * 0.45, length * 0.3, z * 0.45),
    new THREE.Vector3(x, length * 0.7, z),
    new THREE.Vector3(0, length, 0),
  ]);
}

export function stemAxisRotation(height: number, leanX: number, leanZ: number) {
  const vertical = Math.sqrt(Math.max(0, height ** 2 - leanX ** 2 - leanZ ** 2));
  const direction = new THREE.Vector3(leanX, vertical, leanZ).normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
}

export function stemAxisTip(height: number, leanX: number, leanZ: number) {
  return new THREE.Vector3(0, height, 0).applyQuaternion(stemAxisRotation(height, leanX, leanZ));
}
