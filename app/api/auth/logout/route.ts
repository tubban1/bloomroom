import { cookies } from "next/headers";
import { COOKIE_NAME, revokeSessionToken, verifyCsrfOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      await revokeSessionToken(token);
    } catch (e) {
      console.error("Error revoking session", e);
    }
  }

  cookieStore.delete(COOKIE_NAME);
  return Response.json(
    { success: true },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store, no-cache" },
    },
  );
}
