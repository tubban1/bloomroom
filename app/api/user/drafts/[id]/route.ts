import { getCurrentUser, verifyCsrfOrigin } from "@/lib/auth";
import { deleteDraft, getDraftDetail, updateDraft } from "@/lib/drafts";

export const runtime = "nodejs";

const MAX_BODY_SIZE = 1_000_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Invalid draft ID." }, { status: 400 });
  }

  const draft = await getDraftDetail(id, user.id);
  if (!draft) {
    return Response.json({ error: "Draft not found." }, { status: 404 });
  }

  return Response.json(
    { draft },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store, no-cache" },
    },
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Invalid draft ID." }, { status: 400 });
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
    const previewImage = typeof body.preview_image === "string" ? body.preview_image : undefined;
    const version = typeof body.version === "number" ? body.version : undefined;

    const result = await updateDraft(id, user.id, title, bouquetData, previewImage, version);

    if (result.notFound) {
      return Response.json({ error: "Draft not found." }, { status: 404 });
    }

    if (result.conflict) {
      return Response.json(
        { error: "Conflict: This draft has been updated elsewhere. Please review or save as a new copy." },
        { status: 409 },
      );
    }

    return Response.json(
      { draft: result.draft },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store, no-cache" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update draft.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Invalid draft ID." }, { status: 400 });
  }

  const success = await deleteDraft(id, user.id);
  if (!success) {
    return Response.json({ error: "Draft not found or already deleted." }, { status: 404 });
  }

  return Response.json(
    { success: true },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store, no-cache" },
    },
  );
}
