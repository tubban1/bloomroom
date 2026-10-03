import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { GUEST_COOKIE_MAX_AGE, GUEST_COOKIE_NAME } from "./creations";

/**
 * Retrieves the current visitor's guest ID from the cookie, or generates and sets a new one.
 */
export async function getOrCreateGuestId(): Promise<{ guestId: string; isNew: boolean }> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  if (existing && /^[a-zA-Z0-9_-]{16,64}$/.test(existing)) {
    return { guestId: existing, isNew: false };
  }

  const newGuestId = randomBytes(16).toString("base64url");
  try {
    cookieStore.set(GUEST_COOKIE_NAME, newGuestId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  } catch {
    // Ignore in read-only contexts
  }

  return { guestId: newGuestId, isNew: true };
}

/**
 * Reads guest ID without creating a new cookie.
 */
export async function getGuestId(): Promise<string | null> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  if (existing && /^[a-zA-Z0-9_-]{16,64}$/.test(existing)) {
    return existing;
  }
  return null;
}
