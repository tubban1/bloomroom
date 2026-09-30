import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [sourceDirectory, outputFile, branchNode] = process.argv.slice(2);
if (!sourceDirectory || !outputFile) {
  throw new Error("Usage: node scripts/pack-sketchfab-gltf.mjs SOURCE_DIR OUTPUT.glb [BRANCH_NODE]");
}

const gltf = JSON.parse(await fs.readFile(path.join(sourceDirectory, "scene.gltf"), "utf8"));
if (branchNode) gltf.nodes[2].children = [Number(branchNode)];

const chunks = [await fs.readFile(path.join(sourceDirectory, gltf.buffers[0].uri))];
let byteLength = chunks[0].length;
for (const image of gltf.images ?? []) {
  const original = await fs.readFile(path.join(sourceDirectory, image.uri));
  const metadata = await sharp(original).metadata();
  const encoded = Math.max(metadata.width ?? 0, metadata.height ?? 0) > 1024
    ? await sharp(original).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    : original;
  const padding = (4 - byteLength % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); byteLength += padding; }
  image.bufferView = gltf.bufferViews.length;
  image.mimeType = "image/jpeg";
  delete image.uri;
  gltf.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: encoded.length });
  chunks.push(encoded);
  byteLength += encoded.length;
}

for (const material of gltf.materials ?? []) {
  const extensions = material.extensions;
  if (!extensions) continue;
  const gloss = extensions.KHR_materials_pbrSpecularGlossiness;
  if (gloss) {
    material.pbrMetallicRoughness = {
      baseColorTexture: gloss.diffuseTexture,
      baseColorFactor: gloss.diffuseFactor,
      metallicFactor: 0,
      roughnessFactor: 1 - (gloss.glossinessFactor ?? 0),
    };
  }
  delete extensions.KHR_materials_pbrSpecularGlossiness;
  delete extensions.KHR_materials_unlit;
  if (!Object.keys(extensions).length) delete material.extensions;
  material.doubleSided = true;
}
gltf.extensionsUsed = (gltf.extensionsUsed ?? []).filter((name) => name !== "KHR_materials_unlit" && name !== "KHR_materials_pbrSpecularGlossiness");
if (!gltf.extensionsUsed.length) delete gltf.extensionsUsed;
delete gltf.buffers[0].uri;
const binaryPadding = (4 - byteLength % 4) % 4;
if (binaryPadding) { chunks.push(Buffer.alloc(binaryPadding)); byteLength += binaryPadding; }
gltf.buffers[0].byteLength = byteLength;

const jsonSource = Buffer.from(JSON.stringify(gltf));
const json = Buffer.alloc(Math.ceil(jsonSource.length / 4) * 4, 0x20);
jsonSource.copy(json);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + byteLength, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(byteLength, 0);
binaryHeader.writeUInt32LE(0x004e4942, 4);
await fs.writeFile(outputFile, Buffer.concat([header, json, binaryHeader, ...chunks]));
console.log(path.basename(outputFile), (28 + json.length + byteLength).toLocaleString(), "bytes");
