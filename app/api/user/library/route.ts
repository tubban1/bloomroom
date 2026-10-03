import { getCurrentUser } from "@/lib/auth";
import { getUserLibrary } from "@/lib/drafts";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Please log in to view your library." }, { status: 401 });
  }

  const library = await getUserLibrary(user.id);
  return Response.json(
    library,
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store, no-cache" },
    },
  );
}
