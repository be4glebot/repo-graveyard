import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveSiteUrl, SITE_URL_FALLBACK } from "@/lib/site-meta";

// Feature: landing-mobile-states, Property 2: Site URL resolution always yields an absolute URL
// **Validates: Requirements 3.7**
describe("Property 2: Site URL resolution always yields an absolute URL", () => {
  const anyInput = fc.oneof(fc.constant(undefined), fc.string(), fc.webUrl());

  it("never throws and always returns an absolute http(s) URL with a host", () => {
    fc.assert(
      fc.property(anyInput, (raw) => {
        const url = resolveSiteUrl(raw);
        expect(["http:", "https:"]).toContain(url.protocol);
        expect(url.host).not.toBe("");
        expect(() => new URL(url.href)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it("keeps the origin of an absolute http(s) URL", () => {
    fc.assert(
      fc.property(fc.webUrl(), (raw) => {
        expect(resolveSiteUrl(raw).origin).toBe(new URL(raw).origin);
      }),
      { numRuns: 100 },
    );
  });

  it("falls back to localhost for anything that is not an http(s) URL", () => {
    const nonHttp = fc
      .string()
      .filter((s) => !s.toLowerCase().includes("http"));
    fc.assert(
      fc.property(fc.oneof(fc.constant(undefined), nonHttp), (raw) => {
        expect(resolveSiteUrl(raw).href).toBe(
          new URL(SITE_URL_FALLBACK).href,
        );
      }),
      { numRuns: 100 },
    );
  });
});
