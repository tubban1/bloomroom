import { getPostcardImage } from "@/lib/postcards";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{12}$/.test(id)) return new Response(null, { status: 404 });
  const image = await getPostcardImage(id);
  if (!image) return new Response(null, { status: 404 });
  return new Response(Buffer.from(image, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
