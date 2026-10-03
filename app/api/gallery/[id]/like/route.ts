import { checkRateLimit, getCurrentUser, verifyCsrfOrigin } from "@/lib/auth";
import { likeCreation, unlikeCreation } from "@/lib/creations";
import { getOrCreateGuestId } from "@/lib/guest";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Invalid creation ID." }, { status: 400 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  if (!checkRateLimit(clientIp, "gallery_like", 60, 60)) {
    return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const user = await getCurrentUser();
  let guestId: string | null = null;
  if (!user) {
    const guestResult = await getOrCreateGuestId();
    guestId = guestResult.guestId;
  }

  try {
    const result = await likeCreation(id, { userId: user?.id, guestId });
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "private, no-cache, no-store" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to like artwork.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Invalid creation ID." }, { status: 400 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  if (!checkRateLimit(clientIp, "gallery_like", 60, 60)) {
    return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const user = await getCurrentUser();
  let guestId: string | null = null;
  if (!user) {
    const guestResult = await getOrCreateGuestId();
    guestId = guestResult.guestId;
  }

  try {
    const result = await unlikeCreation(id, { userId: user?.id, guestId });
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "private, no-cache, no-store" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to unlike artwork.";
    return Response.json({ error: message }, { status: 400 });
  }
}
