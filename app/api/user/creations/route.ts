import { getCurrentUser } from "@/lib/auth";
import { getUserCreations } from "@/lib/creations";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const creations = await getUserCreations(user.id, 50);

  return Response.json(
    { creations },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-store",
      },
    },
  );
}
