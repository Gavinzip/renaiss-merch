import { copyFile, readFile, writeFile } from "node:fs/promises";
import { getStorefrontMode } from "../server/storefront-mode.mjs";

if (getStorefrontMode() !== "production")
  throw new Error("vercel_pilot_requires_production_storefront");
// Vercel serves an existing index.html before a rewrite. Publish the Store
// entry at the root so the legacy entry cannot become the public homepage.
await copyFile("dist/v1.2/index.html", "dist/index.html");
for (const file of [
  "dist/index.html",
  "dist/v1.2/index.html",
  "dist/draw/index.html",
  "dist/events/pokemon-30/index.html",
  "dist/events/football/index.html",
]) {
  const html = await readFile(file, "utf8");
  await writeFile(
    file,
    html.replace(
      "<head>",
      '<head>\n    <meta name="robots" content="noindex, nofollow, noarchive" />',
    ),
  );
}
