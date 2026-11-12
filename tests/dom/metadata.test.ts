/**
 * Metadata tests (visual fix 2C): the scene routes title themselves
 * "Repo Graveyard \u2014 {user}" instead of the framework default "Create Next App".
 *
 * The page modules import server-only helpers (`next/server`'s `connection`,
 * the data loaders), irrelevant to `generateMetadata`, so those are mocked to
 * inert stubs. `app/layout.tsx` additionally loads `next/font/google` faces,
 * which only run under the Next build transform (not jsdom), so the root
 * default is checked at the source level rather than by importing the module.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/graveyard-loader", () => ({ loadGraveyard: vi.fn() }));
vi.mock("@/lib/estate-loader", () => ({ loadEstate: vi.fn() }));

import { buildRootMetadata, resolveTitle } from "@/lib/site-meta";
import { generateMetadata as userMetadata } from "@/app/g/[username]/page";
import { generateMetadata as repoMetadata } from "@/app/g/[username]/[repo]/page";
import { metadata as estateMetadata } from "@/app/estate/page";

describe("page metadata titles (visual fix 2C)", () => {
  it("the root layout default is no longer the framework placeholder", () => {
    // layout.tsx cannot be imported here (next/font faces need the build
    // transform), so assert the source has dropped the placeholder title.
    const layoutPath = fileURLToPath(
      new URL("../../app/layout.tsx", import.meta.url),
    );
    const src = readFileSync(layoutPath, "utf-8");
    expect(src).not.toContain("Create Next App");
    expect(src).toContain("buildRootMetadata");
    const root = buildRootMetadata(new URL("http://localhost:3000"));
    expect(root.title).toEqual({
      default: "Repo Graveyard",
      template: "%s \u00b7 Repo Graveyard",
    });
  });

  it("the /g/[username] route titles as 'Repo Graveyard \u2014 {user}'", async () => {
    const meta = await userMetadata({
      params: Promise.resolve({ username: "octocat" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toEqual({
      absolute: "Repo Graveyard \u2014 octocat",
    });
  });

  it("the deep-link /g/[username]/[repo] route keeps the owner in the title", async () => {
    const meta = await repoMetadata({
      params: Promise.resolve({ username: "torvalds", repo: "linux" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toEqual({
      absolute: "Repo Graveyard \u2014 torvalds",
    });
  });

  it("the /estate route reads as the sample estate", () => {
    expect(estateMetadata.title).toEqual({
      absolute: "Repo Graveyard \u2014 Sample Estate",
    });
  });

  it("the brand appears exactly once in the resolved estate and repo titles", async () => {
    const template = "%s \u00b7 Repo Graveyard";
    const repo = await repoMetadata({
      params: Promise.resolve({ username: "torvalds", repo: "linux" }),
      searchParams: Promise.resolve({}),
    });
    const titles = [
      resolveTitle(
        estateMetadata.title as { absolute: string },
        template,
      ),
      resolveTitle(repo.title as { absolute: string }, template),
    ];
    expect(titles).toEqual([
      "Repo Graveyard \u2014 Sample Estate",
      "Repo Graveyard \u2014 torvalds",
    ]);
    for (const t of titles) expect(t.split("Repo Graveyard")).toHaveLength(2);
  });
});
