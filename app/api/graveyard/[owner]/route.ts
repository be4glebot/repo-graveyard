import "server-only";

import { createGithubTransport } from "@/lib/github";
import { loadGraveyard } from "@/lib/graveyard-loader";
import { buildGraveyardPayload, mapLoadError } from "@/lib/graveyard-payload";
import {
  clientIp,
  createBucketLimiter,
  GRAVEYARD_ROUTE_BUCKET,
} from "@/lib/ratelimit";
import { createUpstashRedis, createUpstashStore } from "@/lib/ratelimit-store";

const LIMIT = 60;
const WINDOW_MS = 3_600_000;

function json(
  status: number,
  body: unknown,
  extra?: Record<string, string>,
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ owner: string }> },
): Promise<Response> {
  try {
    const { owner } = await ctx.params;

    const redis = await createUpstashRedis();
    const limiter = createBucketLimiter(
      redis ? createUpstashStore(redis) : null,
      Date.now,
      { bucket: GRAVEYARD_ROUTE_BUCKET, limit: LIMIT, windowMs: WINDOW_MS },
    );
    const verdict = await limiter.consume(
      clientIp(request.headers.get("x-forwarded-for")),
    );
    if (!verdict.ok) {
      return json(
        429,
        { error: "rate-limited" },
        { "Retry-After": String(Math.max(1, Math.ceil(verdict.retryAfter))) },
      );
    }

    const result = await loadGraveyard(owner, {
      transport: createGithubTransport(),
      cache: redis,
    });

    if (result.ok) {
      return json(
        200,
        buildGraveyardPayload(owner, result.value, new Date().toISOString()),
      );
    }

    const mapped = mapLoadError(result.error, Date.now());
    return json(
      mapped.status,
      mapped.body,
      mapped.retryAfter === undefined
        ? undefined
        : { "Retry-After": String(mapped.retryAfter) },
    );
  } catch {
    console.error("[graveyard] request failed");
    return json(502, { error: "server-error" });
  }
}
