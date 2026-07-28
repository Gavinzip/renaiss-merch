import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { HttpError } from './http.mjs';

export async function deliverProtectedMedia(req, res, source, options = {}) {
  if (source.type === 'local') {
    await streamLocalMedia(req, res, source, options);
    return;
  }

  await proxyRemoteMedia(req, res, source, options);
}

async function streamLocalMedia(req, res, source, options) {
  let fileStats;

  try {
    fileStats = await stat(source.filePath);
  } catch {
    throw new HttpError(503, options.unavailableCode || 'media_unavailable');
  }

  const range = options.acceptRanges
    ? readByteRange(req.headers.range, fileStats.size)
    : null;
  const start = range?.start ?? 0;
  const end = range?.end ?? fileStats.size - 1;
  const contentLength = end - start + 1;
  const headers = {
    'Cache-Control': 'private, no-store',
    'Content-Length': String(contentLength),
    'Content-Type': source.contentType,
    Vary: 'Cookie'
  };

  if (options.acceptRanges) {
    headers['Accept-Ranges'] = 'bytes';
  }

  if (range) {
    headers['Content-Range'] = `bytes ${start}-${end}/${fileStats.size}`;
  }

  res.writeHead(range ? 206 : 200, headers);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(source.filePath, { start, end }).pipe(res);
}

async function proxyRemoteMedia(req, res, source, options) {
  const headers = {
    ...source.requestHeaders,
    Accept: source.contentType
  };

  if (options.acceptRanges && req.headers.range) {
    headers.Range = req.headers.range;
  }

  let response;

  try {
    response = await fetch(source.remoteUrl, {
      headers,
      method: req.method
    });
  } catch {
    throw new HttpError(
      502,
      options.requestFailedCode || 'media_request_failed'
    );
  }

  if (!response.ok && response.status !== 206) {
    throw new HttpError(502, options.unavailableCode || 'media_unavailable');
  }

  const responseHeaders = {
    'Cache-Control': 'private, no-store',
    'Content-Type': response.headers.get('content-type') || source.contentType,
    Vary: 'Cookie'
  };

  for (const headerName of [
    'accept-ranges',
    'content-length',
    'content-range'
  ]) {
    const value = response.headers.get(headerName);

    if (value) {
      responseHeaders[headerName] = value;
    }
  }

  res.writeHead(response.status, responseHeaders);

  if (req.method === 'HEAD' || !response.body) {
    res.end();
    return;
  }

  Readable.fromWeb(response.body).pipe(res);
}

function readByteRange(value, fileSize) {
  if (!value) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(String(value).trim());

  if (!match || (!match[1] && !match[2])) {
    throw new HttpError(416, 'merch_reveal_range_invalid');
  }

  let start;
  let end;

  if (!match[1]) {
    const suffixLength = Number.parseInt(match[2], 10);

    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      throw new HttpError(416, 'merch_reveal_range_invalid');
    }

    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = Number.parseInt(match[1], 10);
    end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= fileSize ||
    end < start
  ) {
    throw new HttpError(416, 'merch_reveal_range_invalid');
  }

  return {
    end: Math.min(end, fileSize - 1),
    start
  };
}
