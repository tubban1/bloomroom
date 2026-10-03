import * as THREE from "three";

const alphaPixels = new WeakMap<object, Map<number, { width: number; height: number; pixels: Uint8Array }>>();

function textureAlpha(texture: THREE.Texture, uv: THREE.Vector2, channel: number) {
  const image = texture.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!image || typeof document === "undefined") return 1;
  let channels = alphaPixels.get(image);
  let cached = channels?.get(channel);
  if (!cached) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      if (!canvas.width || !canvas.height) return 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return 1;
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const pixels = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < pixels.length; i++) pixels[i] = rgba[i * 4 + channel];
      cached = { width: canvas.width, height: canvas.height, pixels };
      channels ??= new Map();
      channels.set(channel, cached);
      alphaPixels.set(image, channels);
    } catch { return 1; }
  }
  if (texture.matrixAutoUpdate) texture.updateMatrix();
  const mapped = texture.transformUv(uv.clone());
  const x = Math.min(cached.width - 1, Math.max(0, Math.floor(mapped.x * cached.width)));
  const y = Math.min(cached.height - 1, Math.max(0, Math.floor(mapped.y * cached.height)));
  return cached.pixels[y * cached.width + x] / 255;
}

export function visibleBotanicalHit(material: THREE.Material, uv?: THREE.Vector2) {
  if (!material.visible) return false;
  if (!(material instanceof THREE.MeshStandardMaterial)) return true;
  let alpha = material.opacity;
  if (material.alphaTest > 0 && uv) {
    if (material.map) alpha *= textureAlpha(material.map, uv, 3);
    if (material.alphaMap) alpha *= textureAlpha(material.alphaMap, uv, 1);
  }
  return alpha > 0 && alpha >= material.alphaTest;
}

export function installBotanicalRaycast(mesh: THREE.Mesh, ghost: boolean) {
  mesh.raycast = (raycaster, intersections) => {
    if (ghost) return;
    const hits: THREE.Intersection[] = [];
    THREE.Mesh.prototype.raycast.call(mesh, raycaster, hits);
    for (const hit of hits) {
      const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
      if (material && visibleBotanicalHit(material, hit.uv)) intersections.push(hit);
    }
  };
}

export type BotanicalAnchor = { meshName: string; sourcePoint: THREE.Vector3 };

export function firstBotanicalAnchor(root: THREE.Object3D): BotanicalAnchor | null {
  let anchor: BotanicalAnchor | null = null;
  root.traverse(child => {
    if (anchor || !(child instanceof THREE.Mesh) || !child.userData.botanicalPick) return;
    const geometry: THREE.BufferGeometry = child.geometry;
    const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
    const index = geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
      const materialIndex = geometry.groups.find(group => i >= group.start && i < group.start + group.count)?.materialIndex ?? 0;
      const material = Array.isArray(child.material) ? child.material[materialIndex] : child.material;
      const sample = uv ? ids.reduce((sum, id) => sum.add(new THREE.Vector2(uv.getX(id), uv.getY(id))), new THREE.Vector2()).divideScalar(3) : undefined;
      if (!visibleBotanicalHit(material, sample)) continue;
      const point = ids.reduce((sum, id) => sum.add(new THREE.Vector3().fromBufferAttribute(position, id)), new THREE.Vector3()).divideScalar(3);
      anchor = botanicalAnchor(child, child.localToWorld(point), { a: ids[0], b: ids[1], c: ids[2], normal: new THREE.Vector3(), materialIndex });
      break;
    }
  });
  return anchor;
}

export function botanicalAnchor(mesh: THREE.Mesh, point: THREE.Vector3, face: THREE.Face): BotanicalAnchor {
  const position = mesh.geometry.getAttribute("position");
  const source = mesh.geometry.getAttribute("botanicalSource") ?? position;
  const a = new THREE.Vector3().fromBufferAttribute(position, face.a);
  const b = new THREE.Vector3().fromBufferAttribute(position, face.b);
  const c = new THREE.Vector3().fromBufferAttribute(position, face.c);
  const weights = THREE.Triangle.getBarycoord(mesh.worldToLocal(point.clone()), a, b, c, new THREE.Vector3());
  const sourcePoint = new THREE.Vector3();
  if (weights) {
    sourcePoint.addScaledVector(new THREE.Vector3().fromBufferAttribute(source, face.a), weights.x);
    sourcePoint.addScaledVector(new THREE.Vector3().fromBufferAttribute(source, face.b), weights.y);
    sourcePoint.addScaledVector(new THREE.Vector3().fromBufferAttribute(source, face.c), weights.z);
  }
  return { meshName: mesh.name, sourcePoint };
}

/** Recover the same surface point after height, size or branch deformation changes. */
export function resolveBotanicalAnchor(mesh: THREE.Mesh, anchor: BotanicalAnchor) {
  const position = mesh.geometry.getAttribute("position");
  const source = mesh.geometry.getAttribute("botanicalSource") ?? position;
  const index = mesh.geometry.index;
  const count = index?.count ?? position.count;
  const triangle = new THREE.Triangle(), nearest = new THREE.Vector3(), weights = new THREE.Vector3();
  let best = Infinity;
  let result: THREE.Vector3 | null = null;
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
    triangle.a.fromBufferAttribute(source, ids[0]);
    triangle.b.fromBufferAttribute(source, ids[1]);
    triangle.c.fromBufferAttribute(source, ids[2]);
    triangle.closestPointToPoint(anchor.sourcePoint, nearest);
    const distance = nearest.distanceToSquared(anchor.sourcePoint);
    if (distance >= best) continue;
    best = distance;
    triangle.getBarycoord(nearest, weights);
    result = new THREE.Vector3().addScaledVector(new THREE.Vector3().fromBufferAttribute(position, ids[0]), weights.x)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(position, ids[1]), weights.y)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(position, ids[2]), weights.z);
    if (best < 1e-12) break;
  }
  return result;
}
