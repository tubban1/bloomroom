import { cookies } from "next/headers";
import { checkRateLimit, COOKIE_NAME, registerUser, SESSION_MAX_AGE_SECONDS, verifyCsrfOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  if (!checkRateLimit(clientIp, "register", 10, 60)) {
    return Response.json({ error: "Too many registration attempts. Please wait a minute and try again." }, { status: 429 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";

    const { user, sessionToken } = await registerUser(username, password);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return Response.json(
      { user },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store, no-cache" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to register.";
    return Response.json({ error: message }, { status: 400 });
  }
}
