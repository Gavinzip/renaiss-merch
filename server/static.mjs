import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

export function getDistDir() {
  return path.join(rootDir, 'dist');
}

export async function serveStatic(req, res, distDir = getDistDir()) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'method_not_allowed');
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const filePath = await resolveFilePath(url.pathname, distDir);
  const contentType = mimeTypes.get(path.extname(filePath)) || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

async function resolveFilePath(pathname, distDir) {
  const safePathname = decodeURIComponent(pathname);
  const requestedPath = path.resolve(
    distDir,
    safePathname === '/' ? 'index.html' : `.${safePathname}`
  );

  if (!requestedPath.startsWith(distDir)) {
    throw new HttpError(403, 'forbidden');
  }

  try {
    const requestedStat = await stat(requestedPath);

    if (requestedStat.isFile()) {
      return requestedPath;
    }
  } catch {
    return path.join(distDir, 'index.html');
  }

  return path.join(distDir, 'index.html');
}
