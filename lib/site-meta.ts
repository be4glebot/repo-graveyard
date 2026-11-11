import type { Metadata } from "next";

/** Used when NEXT_PUBLIC_SITE_URL is missing or not an absolute http(s) URL. */
export const SITE_URL_FALLBACK = "http://localhost:3000";

/**
 * True once public/og/repo-graveyard-1200x630.jpg is committed (Decision A).
 * While false, metadata points at the existing /art/place-gate.webp.
 */
export const OG_IMAGE_READY = true;

export const OG_IMAGE_ALT =
  "Repo Graveyard: a moonlit castle gate over a haunted cemetery where every abandoned repo leaves something behind.";

const OG_IMAGE_PATH = "/og/repo-graveyard-1200x630.jpg";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const FALLBACK_IMAGE_PATH = "/art/place-gate.webp";

const SITE_NAME = "Repo Graveyard";
const SITE_DESCRIPTION =
  "See a GitHub user's public repositories as a haunted graveyard of ghosts, zombies, tombstones, and chained coffins.";

/** Origin of an absolute http(s) URL, otherwise the localhost fallback. Never throws. */
export function resolveSiteUrl(raw: string | undefined): URL {
  try {
    if (typeof raw === "string") {
      const parsed = new URL(raw.trim());
      if (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        parsed.host !== ""
      ) {
        return new URL(parsed.origin);
      }
    }
  } catch {
    // fall through to the fallback
  }
  return new URL(SITE_URL_FALLBACK);
}

export function buildRootMetadata(siteUrl: URL): Metadata {
  const image = OG_IMAGE_READY
    ? {
        url: OG_IMAGE_PATH,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: OG_IMAGE_ALT,
      }
    : { url: FALLBACK_IMAGE_PATH, alt: OG_IMAGE_ALT };

  return {
    metadataBase: siteUrl,
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    openGraph: {
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      type: "website",
      siteName: SITE_NAME,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: [{ url: image.url, alt: OG_IMAGE_ALT }],
    },
  };
}
