import { getPostcard } from "@/lib/postcards";
import { createSignedAudioUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{12}$/.test(id)) {
    return Response.json({ error: "Invalid postcard ID." }, { status: 404 });
  }

  const postcard = await getPostcard(id);
  if (!postcard || !postcard.audio_path) {
    return Response.json({ error: "Postcard audio not found." }, { status: 404 });
  }

  try {
    // Generate a fresh 5-minute signed URL from Supabase Storage
    const signedUrl = await createSignedAudioUrl(postcard.audio_path, 300);

    const url = new URL(request.url);
    if (url.searchParams.get("redirect") === "1" || request.headers.get("accept")?.includes("audio/")) {
      return new Response(null, {
        status: 307,
        headers: {
          Location: signedUrl,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    }

    return Response.json(
      {
        audioUrl: signedUrl,
        mime: postcard.audio_mime || "audio/webm",
        durationMs: postcard.audio_duration_ms || null,
        sizeBytes: postcard.audio_size_bytes || null,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error) {
    console.error("Failed to generate signed audio URL", error);
    return Response.json({ error: "Could not access postcard audio." }, { status: 503 });
  }
}
