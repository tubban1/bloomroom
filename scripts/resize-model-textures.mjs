import fs from 'node:fs/promises';
import sharp from 'sharp';
const path = process.argv[2];
const source = await fs.readFile(path);
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength));
const binary = source.subarray(28 + jsonLength);
const imageViews = new Set((gltf.images ?? []).map(image => image.bufferView));
const baseColorImages = new Set();
for (const material of gltf.materials ?? []) {
  const textureIndex = material.pbrMetallicRoughness?.baseColorTexture?.index;
  const imageIndex = Number.isInteger(textureIndex) ? gltf.textures?.[textureIndex]?.source : undefined;
  if (Number.isInteger(imageIndex)) baseColorImages.add(imageIndex);
}
const chunks = [];
let offset = 0;
for (let index = 0; index < gltf.bufferViews.length; index++) {
  const view = gltf.bufferViews[index];
  let data = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  if (imageViews.has(index)) {
    const imageIndex = gltf.images.findIndex(image => image.bufferView === index);
    const image = gltf.images[imageIndex];
    const mime = image.mimeType;
    const pipeline = sharp(data).resize({width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true});
    const metadata = await sharp(data).metadata();
    // Opaque base-color PNGs can be stored much smaller as high-quality JPEG.
    // Never convert normal/packed maps or images whose transparency matters.
    const canConvertToJpeg = mime === 'image/png' && baseColorImages.has(imageIndex) && !metadata.hasAlpha;
    const resized = await (mime === 'image/jpeg' || canConvertToJpeg
      ? pipeline.jpeg({quality: 86, mozjpeg: true})
      : pipeline.png({compressionLevel: 9})).toBuffer();
    if (resized.length < data.length || metadata.width > 1024 || metadata.height > 1024) {
      data = resized;
      if (canConvertToJpeg) image.mimeType = 'image/jpeg';
    }
  }
  view.byteOffset = offset;
  view.byteLength = data.length;
  const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
  data.copy(padded);
  chunks.push(padded); offset += padded.length;
}
gltf.buffers[0].byteLength = offset;
const rawJson = Buffer.from(JSON.stringify(gltf));
const json = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 0x20); rawJson.copy(json);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2,4); header.writeUInt32LE(28+json.length+offset,8); header.writeUInt32LE(json.length,12); header.writeUInt32LE(0x4e4f534a,16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(offset); binHeader.writeUInt32LE(0x004e4942,4);
await fs.writeFile(path, Buffer.concat([header,json,binHeader,...chunks]));
console.log(path, 'optimized to', 28+json.length+offset, 'bytes');
