import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { HttpError } from "../http.mjs";

const files = new Map([
  [
    "/api/hub/hero-preview/index.html",
    ["index.html", "text/html; charset=utf-8"],
  ],
  [
    "/api/hub/hero-preview/vendor/gsap.min.js",
    ["vendor/gsap.min.js", "text/javascript; charset=utf-8"],
  ],
  [
    "/api/hub/hero-preview/assets/sealed-box.avif",
    ["assets/sealed-box.avif", "image/avif"],
  ],
]);
const directory = new URL("../../work/videos/merch-hub-loop/", import.meta.url);

// Authoring materials are available only in local development. Production
// delivery uses a reviewed, versioned CDN export, never these source files.
export async function handleHubHeroPreview(req, res, pathname) {
  const asset = files.get(pathname);
  if (!asset) throw new HttpError(404, "hub_hero_asset_not_found");
  if (!["GET", "HEAD"].includes(req.method))
    throw new HttpError(405, "method_not_allowed");
  let body;
  try {
    body = await readFile(fileURLToPath(new URL(asset[0], directory)));
  } catch {
    throw new HttpError(503, "hub_hero_preview_unavailable");
  }
  res.writeHead(200, {
    "Content-Type": asset[1],
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(req.method === "HEAD" ? undefined : body);
}
