import { HttpError } from '../http.mjs';

export async function readProofIndex(origin, path, fetchPublic) {
  let response;
  try { response = await fetchPublic(new URL(path, origin).href, {redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)}); }
  catch { throw new HttpError(502,'proof_source_unavailable'); }
  const reject = async code => { try { await response.body?.cancel(); } finally { throw new HttpError(502,code); } };
  if (!response.ok) return reject('proof_source_unavailable');
  if (!response.body || !response.headers.get('content-type')?.includes('application/json') || Number(response.headers.get('content-length')) > 2*1024*1024) return reject('proof_source_invalid');
  const reader = response.body.getReader(); let bytes=0; const chunks=[];
  try {
    for (;;) { const {done,value}=await reader.read(); if(done)break;
      bytes+=value.length; if(bytes>2*1024*1024)throw new HttpError(502,'proof_source_invalid'); chunks.push(value); }
  } catch(error) { if(error instanceof HttpError)throw error; throw new HttpError(502,'proof_source_unavailable'); }
  // Cancellation can itself reject after a broken stream. Preserve the actual
  // source failure above instead of replacing it with an unclassified 500.
  finally { try { await reader.cancel(); } catch {} }
  try { const value=JSON.parse(Buffer.concat(chunks).toString('utf8')); if(!value || typeof value!=='object' || Array.isArray(value))throw Error(); return value; }
  catch { throw new HttpError(502,'proof_source_invalid'); }
}
