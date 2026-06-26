export class HttpError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);

  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

export function redirect(res, location, status = 302) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    Location: location
  });
  res.end();
}

export function sendNoContent(res) {
  res.writeHead(204, {
    'Cache-Control': 'no-store'
  });
  res.end();
}

export function toHttpError(error) {
  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(500, 'server_error');
}

export function sendHttpError(res, error) {
  const httpError = toHttpError(error);

  sendJson(res, httpError.status, {
    code: httpError.code
  });
}
