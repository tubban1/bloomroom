import { getCurrentUser } from "@/lib/auth";
import { getCreationImageMedia } from "@/lib/creations";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const user = await getCurrentUser();
  const media = await getCreationImageMedia(id, user?.id);

  if (!media) {
    return new Response("Image not found", {
      status: 404,
      headers: {
        "Cache-Control": "private, no-cache, no-store",
      },
    });
  }

  const isPublic = media.visibility === "public";

  return new Response(new Uint8Array(media.buffer), {
    status: 200,
    headers: {
      "Content-Type": media.mime,
      "Content-Length": String(media.buffer.length),
      "Cache-Control": isPublic
        ? "public, max-age=300, stale-while-revalidate=600"
        : "private, no-cache, no-store, must-revalidate",
    },
  });
}
