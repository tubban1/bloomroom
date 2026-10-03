import { NextRequest } from "next/server";
import { generateAiReading, BouquetDataInput } from "@/lib/ai-reading";

export const runtime = "nodejs";

const MAX_BODY_SIZE = 3_000_000; // 3MB limit (accommodates 768px compressed jpeg)

// In-memory rate limiter: 10 requests per 60s window per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) {
    return false;
  }
  entry.count++;
  return true;
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 120_000).unref?.();

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "请求过于频繁，请稍候片刻再试。" },
      {
        status: 429,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          "Retry-After": "30",
        },
      },
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_SIZE) {
    return Response.json(
      { error: "作品数据过大，无法处理。" },
      { status: 413, headers: { "Cache-Control": "private, no-cache, no-store" } },
    );
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_SIZE) {
      return Response.json(
        { error: "作品数据过大，无法处理。" },
        { status: 413, headers: { "Cache-Control": "private, no-cache, no-store" } },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json(
        { error: "无效的请求格式。" },
        { status: 400, headers: { "Cache-Control": "private, no-cache, no-store" } },
      );
    }

    const bouquetData = body.bouquetData as BouquetDataInput;
    if (!bouquetData || !Array.isArray(bouquetData.stems) || bouquetData.stems.length === 0) {
      return Response.json(
        { error: "花束中暂无花材，请先插上鲜花。" },
        { status: 400, headers: { "Cache-Control": "private, no-cache, no-store" } },
      );
    }

    const language = typeof body.language === "string" ? body.language : "zh";
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : undefined;

    const result = await generateAiReading({
      bouquetData,
      imageDataUrl,
      language,
    });

    return Response.json(
      {
        success: true,
        reading: result.reading,
        degradedToText: result.degradedToText,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (error: unknown) {
    console.error("AI reading generation error:", error instanceof Error ? error.message : error);
    const msg = error instanceof Error ? error.message : "AI解读服务暂时不可用，请稍后重试。";
    return Response.json(
      { error: msg },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      },
    );
  }
}
