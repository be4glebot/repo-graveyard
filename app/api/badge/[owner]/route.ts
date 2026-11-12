import "server-only";

import { handleBadgeRequest, unavailableBadgeResponse } from "@/lib/badge-service";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ owner: string }> },
): Promise<Response> {
  let owner: string;
  try {
    ({ owner } = await ctx.params);
  } catch {
    return unavailableBadgeResponse(request);
  }
  return handleBadgeRequest(request, owner, null);
}
