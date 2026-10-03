import { getCurrentUser, verifyCsrfOrigin } from "@/lib/auth";
import { createDraft } from "@/lib/drafts";

export const runtime = "nodejs";

const MAX_BODY_SIZE = 1_000_000;

export async function POST(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Please log in to save drafts." }, { status: 401 });
  }

  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_BODY_SIZE) {
    return Response.json({ error: "Draft payload is too large." }, { status: 413 });
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_SIZE) {
      return Response.json({ error: "Draft payload is too large." }, { status: 413 });
    }

    const body = JSON.parse(raw) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title : "未命名花束";
    const bouquetData = body.bouquet_data && typeof body.bouquet_data === "object"
      ? (body.bouquet_data as Record<string, unknown>)
      : {};
    const previewImage = typeof body.preview_image === "string" ? body.preview_image : null;
    const customId = typeof body.id === "string" ? body.id : undefined;
    const aiReading = body.ai_reading && typeof body.ai_reading === "object"
      ? (body.ai_reading as Record<string, unknown>)
      : null;

    const draft = await createDraft(user.id, title, bouquetData, previewImage, customId, aiReading);
    return Response.json(
      { draft },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store, no-cache" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create draft.";
    return Response.json({ error: message }, { status: 400 });
  }
}
