import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabasePool } from "./db";
function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

export const COOKIE_NAME = "bloomroom_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type SafeUser = {
  id: string;
  username: string;
  created_at: string;
};

// Rate limiting in-memory store (sliding window per IP/action)
type RateLimitRecord = { count: number; expiresAt: number };
const rateLimitStore = new Map<string, RateLimitRecord>();

export function checkRateLimit(ip: string, action: string, maxHits = 10, windowSeconds = 60): boolean {
  const key = `${action}:${ip}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now > current.expiresAt) {
    rateLimitStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return true;
  }

  if (current.count >= maxHits) {
    return false;
  }

  current.count++;
  return true;
}

export function verifyCsrfOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (!host) return true;

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  return true;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string, salt: string): Promise<string> {
  const derivedKey = (await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  })) as Buffer;
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const expectedKey = Buffer.from(parts[2], "hex");
  const derivedKey = (await scryptAsync(password, salt, expectedKey.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  })) as Buffer;

  if (derivedKey.length !== expectedKey.length) return false;
  return timingSafeEqual(derivedKey, expectedKey);
}

export async function registerUser(usernameRaw: string, passwordRaw: string): Promise<{ user: SafeUser; sessionToken: string }> {
  const username = usernameRaw.trim();
  const canonical = username.toLowerCase();

  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    throw new Error("Username must be between 3 and 32 characters, using letters, numbers, or underscores.");
  }

  if (!passwordRaw) {
    throw new Error("Please enter a password.");
  }

  const salt = randomBytes(32).toString("hex");
  const passwordHash = await hashPassword(passwordRaw, salt);

  const db = getDatabasePool();
  try {
    const userResult = await db.query<{ id: string; username: string; created_at: Date }>(
      `INSERT INTO bloomroom.users (username, username_canonical, password_hash, salt)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, created_at`,
      [username, canonical, passwordHash, salt],
    );

    const userRow = userResult.rows[0];
    const sessionToken = randomBytes(32).toString("hex");
    const tokenDigest = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    await db.query(
      `INSERT INTO bloomroom.sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenDigest, userRow.id, expiresAt],
    );

    return {
      user: {
        id: userRow.id,
        username: userRow.username,
        created_at: userRow.created_at.toISOString(),
      },
      sessionToken,
    };
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      throw new Error("This username is already taken. Please choose another.");
    }
    throw error;
  }
}

export async function loginUser(usernameRaw: string, passwordRaw: string): Promise<{ user: SafeUser; sessionToken: string }> {
  const canonical = usernameRaw.trim().toLowerCase();
  const db = getDatabasePool();

  const userResult = await db.query<{
    id: string;
    username: string;
    password_hash: string;
    salt: string;
    created_at: Date;
  }>(
    `SELECT id, username, password_hash, salt, created_at
     FROM bloomroom.users
     WHERE username_canonical = $1`,
    [canonical],
  );

  const userRow = userResult.rows[0];
  if (!userRow) {
    throw new Error("Invalid username or password.");
  }

  const matches = await verifyPassword(passwordRaw, userRow.salt, userRow.password_hash);
  if (!matches) {
    throw new Error("Invalid username or password.");
  }

  const sessionToken = randomBytes(32).toString("hex");
  const tokenDigest = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.query(
    `INSERT INTO bloomroom.sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenDigest, userRow.id, expiresAt],
  );

  return {
    user: {
      id: userRow.id,
      username: userRow.username,
      created_at: userRow.created_at.toISOString(),
    },
    sessionToken,
  };
}

export async function authenticateSessionToken(token: string): Promise<SafeUser | null> {
  if (!token || token.length < 32) return null;
  const tokenDigest = hashToken(token);
  const db = getDatabasePool();

  const result = await db.query<{
    id: string;
    username: string;
    created_at: Date;
  }>(
    `SELECT u.id, u.username, u.created_at
     FROM bloomroom.sessions s
     JOIN bloomroom.users u ON s.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenDigest],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    created_at: row.created_at.toISOString(),
  };
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return authenticateSessionToken(token);
}

export async function revokeSessionToken(token: string): Promise<void> {
  if (!token) return;
  const tokenDigest = hashToken(token);
  const db = getDatabasePool();
  await db.query(`DELETE FROM bloomroom.sessions WHERE token_hash = $1`, [tokenDigest]);
}
