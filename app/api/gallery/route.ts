import { getCurrentUser } from "@/lib/auth";
import { type GallerySort, getGalleryCreations } from "@/lib/creations";
import { getOrCreateGuestId } from "@/lib/guest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sortParam = url.searchParams.get("sort");
  const sort: GallerySort = sortParam === "popular" ? "popular" : "latest";

  const limitParam = Number.parseInt(url.searchParams.get("limit") || "18", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), 60) : 18;

  const offsetParam = Number.parseInt(url.searchParams.get("offset") || "0", 10);
  const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;

  const user = await getCurrentUser();
  let guestId: string | null = null;

  if (!user) {
    const guestResult = await getOrCreateGuestId();
    guestId = guestResult.guestId;
  }

  const { items, total, hasMore } = await getGalleryCreations({
    sort,
    limit,
    offset,
    viewerUserId: user?.id,
    guestId,
  });

  return Response.json(
    {
      items,
      total,
      hasMore,
      sort,
      offset,
      limit,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    },
  );
}
