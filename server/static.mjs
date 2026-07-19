import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import {
  createBrotliCompress,
  createGzip,
  constants as zlibConstants
} from 'node:zlib';
import { HttpError } from './http.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
]);
const immutableAssetPattern = /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;
const compressibleTypes = [
  'application/json',
  'image/svg+xml',
  'text/css',
  'text/html',
  'text/javascript'
];

export function getDistDir() {
  return path.join(rootDir, 'dist');
}

export async function serveStatic(req, res, distDir = getDistDir()) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'method_not_allowed');
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const filePath = await resolveFilePath(url.pathname, distDir);
  const fileStat = await stat(filePath);
  const contentType = mimeTypes.get(path.extname(filePath)) || 'application/octet-stream';
  const contentEncoding = pickContentEncoding(req, contentType, fileStat.size);
  const headers = {
    'Cache-Control': cacheControlFor(filePath),
    'Content-Type': contentType,
    Vary: 'Accept-Encoding'
  };

  if (contentEncoding) {
    headers['Content-Encoding'] = contentEncoding;
  } else {
    headers['Content-Length'] = fileStat.size;
  }

  res.writeHead(200, headers);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  await streamFile(filePath, res, contentEncoding);
}

async function resolveFilePath(pathname, distDir) {
  const resolvedDistDir = path.resolve(distDir);
  const safePathname = decodeURIComponent(pathname);
  const requestedPath = path.resolve(
    resolvedDistDir,
    safePathname === '/' ? 'index.html' : `.${safePathname}`
  );

  if (
    requestedPath !== resolvedDistDir &&
    !requestedPath.startsWith(`${resolvedDistDir}${path.sep}`)
  ) {
    throw new HttpError(403, 'forbidden');
  }

  if (await isFile(requestedPath)) {
    return requestedPath;
  }

  if (safePathname === '/' || isHtmlRoute(safePathname)) {
    return path.join(resolvedDistDir, 'index.html');
  }

  throw new HttpError(404, 'not_found');
}

async function isFile(filePath) {
  try {
    const requestedStat = await stat(filePath);
    return requestedStat.isFile();
  } catch {
    return false;
  }
}

function isHtmlRoute(pathname) {
  return !path.extname(pathname);
}

function cacheControlFor(filePath) {
  const basename = path.basename(filePath);

  if (basename === 'index.html') {
    return 'no-cache, no-store, must-revalidate';
  }

  if (immutableAssetPattern.test(basename)) {
    return 'public, max-age=31536000, immutable';
  }

  return 'public, max-age=3600';
}

function pickContentEncoding(req, contentType, size) {
  if (size < 1024 || !compressibleTypes.some((type) => contentType.startsWith(type))) {
    return '';
  }

  const acceptEncoding = String(req.headers['accept-encoding'] || '');

  if (acceptEncoding.includes('br')) {
    return 'br';
  }

  if (acceptEncoding.includes('gzip')) {
    return 'gzip';
  }

  return '';
}

async function streamFile(filePath, res, contentEncoding) {
  if (contentEncoding === 'br') {
    await pipeline(
      createReadStream(filePath),
      createBrotliCompress({
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 5
        }
      }),
      res
    );
    return;
  }

  if (contentEncoding === 'gzip') {
    await pipeline(createReadStream(filePath), createGzip(), res);
    return;
  }

  await pipeline(createReadStream(filePath), res);
}
