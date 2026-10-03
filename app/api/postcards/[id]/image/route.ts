import { getPostcardImageRecord } from "@/lib/postcards";
import { downloadStorageObject, BUCKET_IMAGES } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{12}$/.test(id)) return new Response(null, { status: 404 });

  const record = await getPostcardImageRecord(id);
  if (!record) return new Response(null, { status: 404 });

  let imageBuffer: Buffer | null = null;

  // 1. If stored in Supabase Storage, fetch from bucket
  if (record.image_path) {
    imageBuffer = await downloadStorageObject(BUCKET_IMAGES, record.image_path);
  }

  // 2. Fallback to legacy base64 if not in storage or storage download unavailable
  if (!imageBuffer && record.image_base64) {
    imageBuffer = Buffer.from(record.image_base64, "base64");
  }

  if (!imageBuffer) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(imageBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
