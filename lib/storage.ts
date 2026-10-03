/**
 * Supabase Storage client and file validation utilities.
 * Uses native fetch for zero extra bundle overhead and full server-side compatibility.
 */

export const BUCKET_IMAGES = "postcard-images";
export const BUCKET_AUDIO = "postcard-audio";

export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://psnxgftfywpzriseetjg.supabase.co"
  ).replace(/\/$/, "");
}

export function getServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || null;
  if (!key || key.trim() === "") return null;
  return key.trim();
}

export function isStorageConfigured(): boolean {
  return Boolean(getServiceRoleKey());
}

/**
 * Automatically create a bucket if it does not exist.
 */
export async function createBucketIfNotExists(bucket: string): Promise<boolean> {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) return false;

  const supabaseUrl = getSupabaseUrl();
  const url = `${supabaseUrl}/storage/v1/bucket`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: bucket === BUCKET_IMAGES,
        file_size_limit: bucket === BUCKET_AUDIO ? 2097152 : 5242880,
      }),
    });
    return response.ok || response.status === 409;
  } catch (err) {
    console.warn(`Could not auto-create bucket ${bucket}:`, err);
    return false;
  }
}

/**
 * Upload an object to a Supabase Storage bucket.
 * Uses upsert: false to forbid overwriting existing files.
 * Automatically tries to create bucket and retries if bucket was missing.
 */
export async function uploadStorageObject(
  bucket: string,
  path: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ path: string }> {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) {
    throw new Error("Supabase Storage service key is not configured");
  }

  const supabaseUrl = getSupabaseUrl();
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": mimeType,
      "x-upsert": "false",
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // If bucket does not exist, auto-create bucket and retry once
    if (response.status === 404 || errorText.toLowerCase().includes("bucket not found")) {
      const created = await createBucketIfNotExists(bucket);
      if (created) {
        const retryRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            "Content-Type": mimeType,
            "x-upsert": "false",
          },
          body: new Uint8Array(buffer),
        });
        if (retryRes.ok) {
          return { path };
        }
      }
    }
    throw new Error(`Storage upload failed (${response.status}): ${errorText}`);
  }

  return { path };
}

/**
 * Download an object directly from Supabase Storage using service credentials.
 */
export async function downloadStorageObject(
  bucket: string,
  path: string,
): Promise<Buffer | null> {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) return null;

  const supabaseUrl = getSupabaseUrl();
  const url = `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${path}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    // Also try public endpoint if authenticated route is unavailable
    const publicUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
    const pubRes = await fetch(publicUrl, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    });
    if (pubRes.ok) {
      return Buffer.from(await pubRes.arrayBuffer());
    }
    return null;
  }

  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Create a short-lived signed URL for private audio files.
 */
export async function createSignedAudioUrl(
  path: string,
  expiresInSeconds = 300,
): Promise<string> {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) {
    throw new Error("Supabase Storage service key is not configured");
  }

  const supabaseUrl = getSupabaseUrl();
  const signUrl = `${supabaseUrl}/storage/v1/object/sign/${BUCKET_AUDIO}/${path}`;

  const response = await fetch(signUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create signed URL (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { signedURL?: string };
  if (!data.signedURL) {
    throw new Error("Signed URL response missing signedURL field");
  }

  const relativeUrl = data.signedURL.startsWith("/") ? data.signedURL : `/${data.signedURL}`;
  return `${supabaseUrl}/storage/v1${relativeUrl}`;
}

/**
 * Delete an object from a Supabase Storage bucket (useful for rollbacks).
 */
export async function deleteStorageObject(
  bucket: string,
  path: string,
): Promise<boolean> {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) return false;

  const supabaseUrl = getSupabaseUrl();
  const url = `${supabaseUrl}/storage/v1/object/${bucket}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [path] }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type ValidatedAudio = {
  mime: string;
  ext: string;
};

/**
 * Strictly inspect magic bytes to verify audio file type and size.
 * Maximum 2MB allowed.
 */
export function validateAudioBuffer(buffer: Buffer): ValidatedAudio | null {
  if (buffer.length < 12) return null;
  if (buffer.length > 2 * 1024 * 1024) return null; // 2MB hard limit

  // WebM: 1A 45 DF A3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { mime: "audio/webm", ext: "webm" };
  }

  // Ogg: 4F 67 67 53 ("OggS")
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return { mime: "audio/ogg", ext: "ogg" };
  }

  // MP4 / M4A: bytes 4..7 are 'ftyp'
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return { mime: "audio/mp4", ext: "m4a" };
  }

  // WAV: 'RIFF' ... 'WAVE'
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE") {
    return { mime: "audio/wav", ext: "wav" };
  }

  // MP3: 'ID3' or MPEG audio frame sync
  if (buffer.subarray(0, 3).toString("ascii") === "ID3") {
    return { mime: "audio/mpeg", ext: "mp3" };
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return { mime: "audio/mpeg", ext: "mp3" };
  }

  return null;
}

export type ValidatedImage = {
  mime: string;
  ext: string;
};

/**
 * Strictly inspect magic bytes for JPEG / PNG images up to 5MB.
 */
export function validateImageBuffer(buffer: Buffer): ValidatedImage | null {
  if (buffer.length < 12 || buffer.length > 5 * 1024 * 1024) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }

  // WebP: 'RIFF' ... 'WEBP'
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}
