// Read-only check of the daytime art in public/art/day/.
// Usage: node scripts/check-day-art.mjs
import { fileURLToPath } from "node:url";
import path from "node:path";

export const EXPECTED = {
  "place-ground": { width: 1536, height: 1024 },
  "mg-fence": { width: 1536, height: 595 },
  "mg-fence-tile": { width: 266, height: 595 },
  mausoleum: { width: 440, height: 600 },
  "tomb-arch-fresh": { width: 398, height: 600 },
  "fg-frame": { width: 1536, height: 1024 },
  "bird-perch": { width: 160, height: 160 },
};

/**
 * Pure comparison. report: { [name]: null | { width, height, hasAlpha,
 * minAlpha?, centreMaxAlpha? } }. Returns one message per problem.
 */
export function compareDayArt(report) {
  const problems = [];
  for (const [name, want] of Object.entries(EXPECTED)) {
    const got = report?.[name];
    if (!got) {
      problems.push(`${name}: file is missing or unreadable`);
      continue;
    }
    if (got.width !== want.width || got.height !== want.height) {
      problems.push(
        `${name}: expected ${want.width}x${want.height}, got ${got.width}x${got.height}`,
      );
    }
    if (name === "place-ground") {
      if (got.hasAlpha && (got.minAlpha ?? 0) < 255) {
        problems.push(`${name}: expected fully opaque, found transparent pixels`);
      }
    }
    if (name === "fg-frame") {
      if (!got.hasAlpha) {
        problems.push(`${name}: expected an alpha channel, found none`);
      } else if ((got.centreMaxAlpha ?? 255) > 0) {
        problems.push(`${name}: centre region is not transparent`);
      }
    }
  }
  return problems;
}

async function inspect(sharp, file, name) {
  const img = sharp(file);
  const meta = await img.metadata();
  const info = { width: meta.width, height: meta.height, hasAlpha: Boolean(meta.hasAlpha) };
  if (name === "place-ground" && info.hasAlpha) {
    const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let min = 255;
    for (let i = 3; i < data.length; i += 4) if (data[i] < min) min = data[i];
    info.minAlpha = min;
  }
  if (name === "fg-frame" && info.hasAlpha) {
    const w = meta.width;
    const h = meta.height;
    const region = {
      left: Math.floor(w * 0.3),
      top: Math.floor(h * 0.3),
      width: Math.floor(w * 0.4),
      height: Math.floor(h * 0.4),
    };
    const { data } = await sharp(file)
      .ensureAlpha()
      .extract(region)
      .raw()
      .toBuffer({ resolveWithObject: true });
    let max = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > max) max = data[i];
    info.centreMaxAlpha = max;
  }
  return info;
}

async function main() {
  const { default: sharp } = await import("sharp");
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "art", "day");
  const report = {};
  for (const name of Object.keys(EXPECTED)) {
    try {
      report[name] = await inspect(sharp, path.join(dir, `${name}.webp`), name);
    } catch {
      report[name] = null;
    }
    const r = report[name];
    console.log(
      r ? `${name}: ${r.width}x${r.height} hasAlpha=${r.hasAlpha}` : `${name}: MISSING`,
    );
  }
  const problems = compareDayArt(report);
  if (problems.length) {
    for (const p of problems) console.error(`MISMATCH ${p}`);
    process.exit(1);
  }
  console.log("Day art OK");
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
