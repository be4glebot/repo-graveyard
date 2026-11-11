import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { OG_IMAGE_READY, buildRootMetadata } from "@/lib/site-meta";

// Validates: Requirements 3.2, 3.3, 3.8

const root = process.cwd();
const jpegPath = path.join(root, "public", "og", "repo-graveyard-1200x630.jpg");

/** Reads width/height from the first SOF marker (SOF0..SOF15 minus DHT/JPG/DAC). */
function jpegSize(buf: Buffer): { width: number; height: number } {
  expect(buf[0]).toBe(0xff);
  expect(buf[1]).toBe(0xd8);
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("no SOF marker found");
}

describe("share image (conditional on OG_IMAGE_READY)", () => {
  const meta = buildRootMetadata(new URL("https://example.com"));
  const og = meta.openGraph as unknown as { images: { url: string }[] };

  if (!OG_IMAGE_READY) {
    it("falls back to /art/place-gate.webp while the image is not ready", () => {
      expect(og.images[0].url).toBe("/art/place-gate.webp");
    });
  } else {
    it("points at the committed OG image", () => {
      expect(og.images[0].url).toBe("/og/repo-graveyard-1200x630.jpg");
    });

    it("the JPEG exists and is at most 300 KB", () => {
      expect(existsSync(jpegPath)).toBe(true);
      expect(statSync(jpegPath).size).toBeLessThanOrEqual(300 * 1024);
    });

    it("the JPEG SOF header reports 1200 x 630", () => {
      expect(jpegSize(readFileSync(jpegPath))).toEqual({
        width: 1200,
        height: 630,
      });
    });
  }
});

describe(".env.example", () => {
  it("documents NEXT_PUBLIC_SITE_URL", () => {
    const env = readFileSync(path.join(root, ".env.example"), "utf-8");
    expect(env).toContain("NEXT_PUBLIC_SITE_URL");
  });
});
