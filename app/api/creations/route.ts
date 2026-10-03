import { checkRateLimit, getCurrentUser, verifyCsrfOrigin } from "@/lib/auth";
import { type CreationVisibility, createCreation } from "@/lib/creations";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  if (!checkRateLimit(clientIp, "create_creation", 30, 60)) {
    return Response.json({ error: "Too many creations submitted. Please wait a minute." }, { status: 429 });
  }

  const user = await getCurrentUser();
  const contentType = request.headers.get("content-type") || "";

  try {
    let title = "未命名花束";
    let bouquetData: Record<string, unknown> = {};
    let imageBuffer: Buffer | null = null;
    let visibility: CreationVisibility = "public";
    let sourceDraftId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      title = String(formData.get("title") || "").trim() || "未命名花束";
      const rawBouquet = String(formData.get("bouquet_data") || "");
      try {
        bouquetData = JSON.parse(rawBouquet);
      } catch {
        bouquetData = {};
      }
      const vis = String(formData.get("visibility") || "public");
      visibility = vis === "private" ? "private" : "public";
      sourceDraftId = String(formData.get("source_draft_id") || "") || null;

      const imageEntry = formData.get("preview_image") || formData.get("image");
      if (imageEntry instanceof File) {
        const ab = await imageEntry.arrayBuffer();
        imageBuffer = Buffer.from(ab);
      } else if (typeof imageEntry === "string" && imageEntry.startsWith("data:image/")) {
        const commaIdx = imageEntry.indexOf(",");
        if (commaIdx !== -1) {
          imageBuffer = Buffer.from(imageEntry.slice(commaIdx + 1), "base64");
        }
      }
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      title = typeof body.title === "string" ? body.title.trim() : "未命名花束";
      bouquetData = body.bouquet_data && typeof body.bouquet_data === "object"
        ? (body.bouquet_data as Record<string, unknown>)
        : {};
      const vis = typeof body.visibility === "string" ? body.visibility : "public";
      visibility = vis === "private" ? "private" : "public";
      sourceDraftId = typeof body.source_draft_id === "string" ? body.source_draft_id : null;

      const previewImage = typeof body.preview_image === "string" ? body.preview_image : null;
      if (previewImage && previewImage.startsWith("data:image/")) {
        const commaIdx = previewImage.indexOf(",");
        if (commaIdx !== -1) {
          imageBuffer = Buffer.from(previewImage.slice(commaIdx + 1), "base64");
        }
      }
    }

    if (imageBuffer && imageBuffer.length > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Image file exceeds 5MB limit." }, { status: 400 });
    }

    // Only registered users can save as private
    if (!user) {
      visibility = "public";
    }

    const creation = await createCreation({
      ownerUserId: user?.id,
      sourceDraftId,
      title,
      bouquetData,
      imageBuffer,
      visibility,
    });

    return Response.json(
      {
        creation: {
          id: creation.id,
          title: creation.title,
          visibility: creation.visibility,
          like_count: creation.like_count,
          published_at: creation.published_at.toISOString(),
          created_at: creation.created_at.toISOString(),
          image_url: `/api/creations/${creation.id}/image`,
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create artwork.";
    return Response.json({ error: message }, { status: 400 });
  }
}
