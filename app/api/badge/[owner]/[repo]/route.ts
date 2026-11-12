import "server-only";

import { handleBadgeRequest, unavailableBadgeResponse } from "@/lib/badge-service";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ owner: string; repo: string }> },
): Promise<Response> {
  let owner: string;
  let repo: string;
  try {
    ({ owner, repo } = await ctx.params);
  } catch {
    return unavailableBadgeResponse(request);
  }
  return handleBadgeRequest(request, owner, repo);
}
