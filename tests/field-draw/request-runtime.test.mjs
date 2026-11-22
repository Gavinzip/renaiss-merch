import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readJsonBody } from '../../server/request-json.mjs';
import { clientAddressHash } from '../../server/draw-room/client-address.mjs';

test('JSON requests work with both Node streams and Vercel parsed bodies', async () => {
  const payload = { text: '甲\n乙', format: 'txt' };
  assert.deepEqual(await readJsonBody(Readable.from([Buffer.from(JSON.stringify(payload))])), payload);
  // There is deliberately no async iterator or socket on this hosted request.
  assert.deepEqual(await readJsonBody({body:payload, headers:{}}), payload);
  assert.deepEqual(await readJsonBody({body:JSON.stringify(payload)}), payload);
  assert.deepEqual(await readJsonBody({body:Buffer.from(JSON.stringify(payload))}), payload);
});
test('parsed and streamed input retain UTF-8 limits and reject malformed JSON', async () => {
  for (const request of [{body:{name:'甲'}}, {body:'{"name":"甲"}'}, Readable.from([Buffer.from('{"name":"甲"}')])])
    await assert.rejects(readJsonBody(request, 12), error => error.status === 413);
  await assert.rejects(readJsonBody({body:{},headers:{'content-length':'100'}} ,16), error => error.status === 413);
  await assert.rejects(readJsonBody({body:'broken'}), error => error.code === 'invalid_json');
  await assert.rejects(readJsonBody(Readable.from([])), error => error.code === 'request_body_required');
});
test('hosted rate limiting uses the edge client IP without requiring a socket', () => {
  const first=clientAddressHash({headers:{'x-forwarded-for':'203.0.113.1'}},{VERCEL:'1'});
  const second=clientAddressHash({headers:{'x-forwarded-for':'203.0.113.2'}},{VERCEL:'1'});
  assert.notEqual(first, second);
  assert.equal(first,clientAddressHash({headers:{'x-forwarded-for':'203.0.113.1, 10.0.0.1'}},{VERCEL:'1'}));
  assert.throws(()=>clientAddressHash({headers:{}},{VERCEL:'1'}),error=>error.code==='client_address_unavailable');
});
test('standalone rate limiting ignores untrusted forwarding headers', () => {
  const req={headers:{'x-forwarded-for':'203.0.113.99'},socket:{remoteAddress:'127.0.0.1'}};
  assert.equal(clientAddressHash(req,{}),clientAddressHash({...req,headers:{}},{}));
});
