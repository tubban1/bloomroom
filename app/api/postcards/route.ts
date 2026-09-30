import { randomBytes } from "node:crypto";
import { createPostcard } from "@/lib/postcards";

export const runtime = "nodejs";

const MAX_BODY = 1_600_000;

export async function POST(request: Request) {
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_BODY) return Response.json({ error: "Postcard image is too large." }, { status: 413 });

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return Response.json({ error: "Postcard image is too large." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    const bouquet = typeof body.bouquet === "string" ? body.bouquet : "";
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const from = typeof body.from === "string" ? body.from.trim() : "";
    const image = typeof body.image === "string" ? body.image : "";

    if (!/^[A-Za-z0-9_-]{1,12000}$/.test(bouquet)
      || to.length > 64 || message.length > 240 || from.length > 64
      || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image)
      || image.length > 1_400_000) {
      return Response.json({ error: "Please check the postcard details and try again." }, { status: 400 });
    }

    const id = randomBytes(9).toString("base64url");
    await createPostcard({
      id,
      bouquet,
      to_name: to,
      message,
      from_name: from,
      image_base64: image.slice("data:image/jpeg;base64,".length),
    });
    return Response.json({ id, path: `/g/${id}` }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid postcard data." }, { status: 400 });
    console.error("Could not create postcard", error);
    return Response.json({ error: "Could not save the postcard. Please try again." }, { status: 503 });
  }
}
