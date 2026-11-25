// Local development media only. This handler is never imported by production API.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {HttpError} from './http.mjs';
const assetRoot = new URL('../work/assets/community-event-archives/', import.meta.url);
const catalogFile = new URL('../media/community-event-archive-asset-release.json', import.meta.url);
export async function handleLocalEventArchiveAsset(req, res, url) {
  if (!url.pathname.startsWith('/local-event-archive-assets/')) return false;
  if (!['GET','HEAD'].includes(req.method)) throw new HttpError(405,'method_not_allowed');
  const key = decodeURIComponent(url.pathname.slice('/local-event-archive-assets/'.length));
  const catalog = JSON.parse(await fs.readFile(catalogFile,'utf8')), asset = catalog.assets[key];
  if (!asset) throw new HttpError(404,'not_found');
  const target = new URL(asset.path, assetRoot);
  if (!target.href.startsWith(assetRoot.href)) throw new HttpError(403,'forbidden');
  const bytes = await fs.readFile(fileURLToPath(target));
  res.writeHead(200,{'Content-Type':asset.contentType,'Content-Length':bytes.length,'Cache-Control':'no-store'});
  res.end(req.method === 'HEAD' ? undefined : bytes);
  return true;
}
