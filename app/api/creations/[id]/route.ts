import { getCurrentUser, verifyCsrfOrigin } from "@/lib/auth";
import {
  type CreationVisibility,
  deleteCreation,
  getCreationDetail,
  updateCreation,
} from "@/lib/creations";
import { getGuestId } from "@/lib/guest";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Artwork not found." }, { status: 404 });
  }

  const user = await getCurrentUser();
  const guestId = await getGuestId();

  const creation = await getCreationDetail(id, user?.id, guestId);
  if (!creation) {
    return Response.json({ error: "Artwork not found or is private." }, { status: 404 });
  }

  return Response.json(
    { creation },
    {
      status: 200,
      headers: {
        "Cache-Control":
          creation.visibility === "public"
            ? "public, max-age=60, stale-while-revalidate=120"
            : "private, no-cache, no-store",
      },
    },
  );
}

export async function PATCH(request: Request, context: Context) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Artwork not found." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const updates: { title?: string; visibility?: CreationVisibility } = {};

    if (typeof body.title === "string") {
      updates.title = body.title;
    }
    if (body.visibility === "public" || body.visibility === "private") {
      updates.visibility = body.visibility;
    }

    const updated = await updateCreation(id, user.id, updates);
    if (!updated) {
      return Response.json({ error: "Artwork not found or you do not have permission to modify it." }, { status: 404 });
    }

    return Response.json(
      {
        creation: {
          id: updated.id,
          title: updated.title,
          visibility: updated.visibility,
          like_count: updated.like_count,
          published_at: updated.published_at.toISOString(),
          updated_at: updated.updated_at.toISOString(),
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update artwork.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Artwork not found." }, { status: 404 });
  }

  const deleted = await deleteCreation(id, user.id);
  if (!deleted) {
    return Response.json({ error: "Artwork not found or not owned by you." }, { status: 404 });
  }

  return Response.json({ success: true }, { status: 200 });
}
