import "server-only";

import { loadGraveyard } from "@/lib/graveyard-loader";
import { createGithubTransport } from "@/lib/github";
import { createLlmClient } from "@/lib/llm";
import { clientIp, createRateLimiter } from "@/lib/ratelimit";
import { createUpstashRedis, createUpstashStore } from "@/lib/ratelimit-store";
import { fetchEvidence } from "@/lib/seance-gather";
import { seanceRequestSchema } from "@/lib/seance-schema";
import { runSeance } from "@/lib/seance-service";

export const maxDuration = 30;

const MAX_BODY_BYTES = 4096;

function badRequest(): Response {
  return Response.json(
    { error: "bad request" },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  // Validate first: nothing below runs on a bad body, and nothing is echoed.
  let parsedBody: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return badRequest();
    }
    parsedBody = JSON.parse(text);
  } catch {
    return badRequest();
  }
  const parsed = seanceRequestSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return badRequest();
  }
  const { owner, repo } = parsed.data;

  const redis = await createUpstashRedis();
  const transport = createGithubTransport();

  const outcome = await runSeance(
    { owner, repo, ip: clientIp(request.headers.get("x-forwarded-for")) },
    {
      loadGraveyard: (o) => loadGraveyard(o, { transport, cache: redis }),
      fetchEvidence: (o, r) => fetchEvidence(transport, o, r),
      llm: createLlmClient(),
      cache: redis,
      limiter: createRateLimiter(
        redis ? createUpstashStore(redis) : null,
        Date.now,
      ),
      log: ({ repo: r, reason }) => console.warn("[seance]", { repo: r, reason }),
      // Dev-only: one safe line per failed attempt (never the key, prompt or text).
      diag:
        process.env.NODE_ENV !== "production"
          ? (entry) => console.warn("[seance:diag]", JSON.stringify(entry))
          : undefined,
    },
  );

  return Response.json(outcome, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
