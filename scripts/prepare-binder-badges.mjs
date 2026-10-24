// Fetch the official public catalog; retain source bytes outside public/dist/Git.
// Publish the resulting manifest with scripts/r2-merch-assets.mjs publish.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { readSbtBadgeCatalog } from '../server/sbt-catalog.mjs';

const folder = 'work/member-binder-release';
const catalog = await readSbtBadgeCatalog();
await mkdir(`${folder}/badges`, { recursive: true });
await mkdir(`${folder}/encoded`, { recursive: true });
const queue = [...catalog.badges];
const assets = {};
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const badge = queue.shift();
    const source = `${folder}/badges/badge-${badge.id}.png`;
    let bytes;
    try { bytes = await readFile(source); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const response = await fetch(badge.imageUrl, { signal: AbortSignal.timeout(30000) });
      if (!response.ok || !response.headers.get('content-type')?.includes('image/png'))
        throw new Error(`badge_download_failed:${badge.id}`);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(source, bytes);
    }
    const output = `${folder}/encoded/badge-${badge.id}.avif`;
    await sharp(bytes).avif({ quality: 90, effort: 5, chromaSubsampling: '4:4:4' }).toFile(output);
    assets[String(badge.id)] = { type: 'binary', source: output, contentType: 'image/avif',
      path: `badge-${badge.id}.avif`, upstream: badge.imageUrl,
      upstreamSha256: createHash('sha256').update(bytes).digest('hex') };
  }
}));
await writeFile('media/member-binder-badges-release.json', JSON.stringify({
  access: 'public', bucket: 'renaiss-merch-pilot-20261018', prefix: 'merch/binder-badges',
  assets: Object.fromEntries(Object.entries(assets).sort(([a], [b]) => Number(a) - Number(b))),
}, null, 2) + '\n');
console.log(`Prepared ${Object.keys(assets).length} public badge images.`);
