import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setImmediate } from 'node:timers/promises';
import { HttpError, sendHttpError } from '../../server/http.mjs';

test('an aborted asset stream cannot send a second response or stop later requests', async () => {
  let finishStream;
  const streamFinished = new Promise(resolve => { finishStream = resolve; });
  let responseError;
  const server = http.createServer((req, res) => {
    if (req.url !== '/asset') {
      sendHttpError(res, new HttpError(404, 'not_found'));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    const data = Readable.from((async function* () {
      for (let index = 0; index < 1024; index++) {
        yield Buffer.alloc(64 * 1024);
        await setImmediate();
      }
    })());
    void pipeline(data, res).catch(error => {
      try { sendHttpError(res, error); } catch (cause) { responseError = cause; }
    }).finally(finishStream);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await new Promise((resolve, reject) => {
      const request = http.get(`${origin}/asset`, { agent: false }, response => {
        response.on('error', () => {});
        response.once('data', () => { response.destroy(); resolve(); });
      });
      request.on('error', reject);
    });
    await streamFinished;
    assert.equal(responseError, undefined);
    const next = await fetch(`${origin}/missing`);
    assert.equal(next.status, 404);
    assert.equal(next.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await next.json(), { code: 'not_found' });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
