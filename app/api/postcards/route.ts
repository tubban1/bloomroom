import { randomBytes } from "node:crypto";
import { checkRateLimit, getCurrentUser, verifyCsrfOrigin } from "@/lib/auth";
import { createPostcard } from "@/lib/postcards";
import {
  BUCKET_AUDIO,
  BUCKET_IMAGES,
  deleteStorageObject,
  isStorageConfigured,
  uploadStorageObject,
  validateAudioBuffer,
  validateImageBuffer,
} from "@/lib/storage";

export const runtime = "nodejs";

const MAX_JSON_BODY = 1_800_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_AUDIO_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  if (!checkRateLimit(ip, "postcards_create", 20, 60)) {
    return Response.json(
      { error: "Too many postcards created. Please wait a minute." },
      { status: 429 },
    );
  }

  const contentType = request.headers.get("content-type") || "";

  // Handle multipart/form-data (New submission with image file and optional voice audio)
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();

      const bouquet = String(formData.get("bouquet") || "");
      const to = String(formData.get("to") || "").trim();
      const message = String(formData.get("message") || "").trim();
      const from = String(formData.get("from") || "").trim();

      if (!/^[A-Za-z0-9_-]{1,12000}$/.test(bouquet)) {
        return Response.json({ error: "Invalid bouquet data." }, { status: 400 });
      }
      if (to.length > 64 || message.length > 240 || from.length > 64) {
        return Response.json({ error: "Text field length exceeded." }, { status: 400 });
      }

      // 1. Process Image
      const imageEntry = formData.get("image");
      let imageBuffer: Buffer | null = null;

      if (imageEntry instanceof File) {
        const arrayBuf = await imageEntry.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
      } else if (typeof imageEntry === "string" && imageEntry.startsWith("data:image/")) {
        const commaIdx = imageEntry.indexOf(",");
        if (commaIdx !== -1) {
          imageBuffer = Buffer.from(imageEntry.slice(commaIdx + 1), "base64");
        }
      }

      if (!imageBuffer || imageBuffer.length > MAX_IMAGE_BYTES) {
        return Response.json(
          { error: "Postcard image is invalid or exceeds 5MB." },
          { status: 400 },
        );
      }

      const validatedImage = validateImageBuffer(imageBuffer);
      if (!validatedImage) {
        return Response.json(
          { error: "Invalid image format. Only JPEG, PNG, and WebP are allowed." },
          { status: 400 },
        );
      }

      // 2. Process Audio (Optional)
      const audioEntry = formData.get("audio");
      let audioBuffer: Buffer | null = null;
      let validatedAudio: ReturnType<typeof validateAudioBuffer> = null;
      let audioDurationMs: number | null = null;

      if (audioEntry instanceof File && audioEntry.size > 0) {
        if (audioEntry.size > MAX_AUDIO_BYTES) {
          return Response.json(
            { error: "Audio recording exceeds the 2MB size limit." },
            { status: 400 },
          );
        }
        audioBuffer = Buffer.from(await audioEntry.arrayBuffer());
        validatedAudio = validateAudioBuffer(audioBuffer);

        if (!validatedAudio) {
          return Response.json(
            {
              error:
                "Unsupported audio file. Please record using a supported browser or remove audio.",
            },
            { status: 400 },
          );
        }

        const durationRaw = Number(formData.get("audioDurationMs"));
        if (Number.isFinite(durationRaw) && durationRaw > 0) {
          audioDurationMs = Math.min(Math.round(durationRaw), 35000); // Max 35s recorded limit
        }
      }

      // Owner determined by session
      const currentUser = await getCurrentUser();
      const userId = currentUser ? currentUser.id : null;

      const id = randomBytes(9).toString("base64url");
      let uploadedImagePath: string | null = null;
      let uploadedAudioPath: string | null = null;

      // 3. Upload to Supabase Storage if configured
      if (isStorageConfigured()) {
        try {
          const imagePath = `images/${id}.${validatedImage.ext}`;
          await uploadStorageObject(BUCKET_IMAGES, imagePath, imageBuffer, validatedImage.mime);
          uploadedImagePath = imagePath;
        } catch (imageErr) {
          console.warn("Storage image upload failed, falling back to base64 in database:", imageErr);
          // Graceful fallback: image will be stored as base64 in database so user never sees a failure
          uploadedImagePath = null;
        }

        if (audioBuffer && validatedAudio) {
          try {
            const audioPath = `audio/${id}.${validatedAudio.ext}`;
            await uploadStorageObject(BUCKET_AUDIO, audioPath, audioBuffer, validatedAudio.mime);
            uploadedAudioPath = audioPath;
          } catch (audioErr) {
            console.error("Storage audio upload failed:", audioErr);
            if (uploadedImagePath) await deleteStorageObject(BUCKET_IMAGES, uploadedImagePath);
            return Response.json(
              { error: "Could not upload voice recording to storage. Please try again or remove voice greeting to send." },
              { status: 503 },
            );
          }
        }
      } else {
        // If storage is not configured, audio requires storage
        if (audioBuffer) {
          return Response.json(
            {
              error:
                "Audio storage is not yet configured on this server. Please remove voice greeting or configure SUPABASE_SERVICE_ROLE_KEY.",
            },
            { status: 503 },
          );
        }
      }

      // 4. Save to Database
      try {
        await createPostcard({
          id,
          bouquet,
          to_name: to,
          message,
          from_name: from,
          image_path: uploadedImagePath,
          image_base64: uploadedImagePath ? null : imageBuffer.toString("base64"),
          audio_path: uploadedAudioPath,
          audio_mime: validatedAudio ? validatedAudio.mime : null,
          audio_duration_ms: audioDurationMs,
          audio_size_bytes: audioBuffer ? audioBuffer.length : null,
          user_id: userId,
        });

        return Response.json({ id, path: `/g/${id}` }, { status: 201 });
      } catch (dbError) {
        console.error("Database save failed, cleaning up storage files", dbError);
        if (uploadedImagePath) await deleteStorageObject(BUCKET_IMAGES, uploadedImagePath);
        if (uploadedAudioPath) await deleteStorageObject(BUCKET_AUDIO, uploadedAudioPath);
        return Response.json(
          { error: "Could not save postcard to database. Please try again." },
          { status: 503 },
        );
      }
    } catch (error) {
      console.error("Could not parse form data", error);
      return Response.json({ error: "Invalid form data." }, { status: 400 });
    }
  }

  // Handle application/json (Legacy request compatibility)
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_JSON_BODY) {
    return Response.json({ error: "Postcard image is too large." }, { status: 413 });
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_JSON_BODY) {
      return Response.json({ error: "Postcard image is too large." }, { status: 413 });
    }
    const body = JSON.parse(raw) as Record<string, unknown>;
    const bouquet = typeof body.bouquet === "string" ? body.bouquet : "";
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const from = typeof body.from === "string" ? body.from.trim() : "";
    const image = typeof body.image === "string" ? body.image : "";

    if (
      !/^[A-Za-z0-9_-]{1,12000}$/.test(bouquet) ||
      to.length > 64 ||
      message.length > 240 ||
      from.length > 64 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) ||
      image.length > 1_400_000
    ) {
      return Response.json(
        { error: "Please check the postcard details and try again." },
        { status: 400 },
      );
    }

    const currentUser = await getCurrentUser();
    const userId = currentUser ? currentUser.id : null;

    const id = randomBytes(9).toString("base64url");
    const imageBase64 = image.slice("data:image/jpeg;base64,".length);
    let uploadedImagePath: string | null = null;

    if (isStorageConfigured()) {
      try {
        const imageBuf = Buffer.from(imageBase64, "base64");
        const path = `images/${id}.jpg`;
        await uploadStorageObject(BUCKET_IMAGES, path, imageBuf, "image/jpeg");
        uploadedImagePath = path;
      } catch (err) {
        console.warn("Storage upload failed for JSON request, falling back to base64 in DB", err);
      }
    }

    await createPostcard({
      id,
      bouquet,
      to_name: to,
      message,
      from_name: from,
      image_path: uploadedImagePath,
      image_base64: uploadedImagePath ? null : imageBase64,
      user_id: userId,
    });

    return Response.json({ id, path: `/g/${id}` }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid postcard data." }, { status: 400 });
    }
    console.error("Could not create postcard", error);
    return Response.json(
      { error: "Could not save the postcard. Please try again." },
      { status: 503 },
    );
  }
}
