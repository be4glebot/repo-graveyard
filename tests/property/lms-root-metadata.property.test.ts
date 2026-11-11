import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildRootMetadata, resolveSiteUrl } from "@/lib/site-meta";

// Feature: landing-mobile-states, Property 3: Root metadata is complete for any site URL
// **Validates: Requirements 3.1, 3.4**

const rawUrl = fc.oneof(
  fc.webUrl(),
  fc.string(),
  fc.constant(undefined),
  fc.constantFrom("", "ftp://x.com", "https://example.com/path?q=1", "not a url"),
);

describe("Property 3: Root metadata is complete for any site URL", () => {
  it("holds for any resolved site URL", () => {
    fc.assert(
      fc.property(rawUrl, (raw) => {
        const url = resolveSiteUrl(raw);
        const meta = buildRootMetadata(url);

        const title = meta.title as { default: string; template: string };
        expect(typeof title.template).toBe("string");
        expect(title.template).toContain("%s");

        expect(typeof meta.description).toBe("string");
        const len = (meta.description as string).length;
        expect(len).toBeGreaterThanOrEqual(50);
        expect(len).toBeLessThanOrEqual(160);

        expect(meta.metadataBase).toBeInstanceOf(URL);
        const base = new URL(String(meta.metadataBase));
        expect(base.href).toBe(url.href);
        expect(["http:", "https:"]).toContain(base.protocol);

        const og = meta.openGraph as unknown as {
          title: string;
          description: string;
          type: string;
          siteName: string;
          images: { url: string; alt: string }[];
        };
        expect(og.title).toBeTruthy();
        expect(og.description).toBeTruthy();
        expect(og.type).toBe("website");
        expect(og.siteName).toBeTruthy();

        expect((meta.twitter as { card: string }).card).toBe(
          "summary_large_image",
        );

        expect(Array.isArray(og.images)).toBe(true);
        expect(og.images).toHaveLength(1);
        const image = og.images[0];
        expect(image.alt.length).toBeGreaterThanOrEqual(1);
        expect(image.alt.length).toBeLessThanOrEqual(200);
        expect(image.alt).toContain("Repo Graveyard");

        const abs = new URL(image.url, base);
        expect(["http:", "https:"]).toContain(abs.protocol);
        expect(abs.origin).toBe(url.origin);
      }),
      { numRuns: 100 },
    );
  });
});
