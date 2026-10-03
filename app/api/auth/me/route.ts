import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  return Response.json(
    { user },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store, no-cache" },
    },
  );
}
