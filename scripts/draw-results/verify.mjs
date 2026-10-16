import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getAddress } from 'ethers';
import build from '../../shared/draw-results-contract.json' with { type: 'json' };

// Publishes only reviewed Solidity sources/settings. Credentials stay in the
// process; no credential-bearing URL or provider response is printed.
const root = fileURLToPath(new URL('../../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'contracts/draw-results/compiler.json'), 'utf8'));
const sources = Object.fromEntries(await Promise.all(config.sourceFiles.map(async file =>
  [file, { content: await readFile(path.join(root, file), 'utf8') }])));
const inputText = JSON.stringify({ language: 'Solidity', sources, settings: config.settings });
if (createHash('sha256').update(inputText).digest('hex') !== build.inputSha256) throw new Error('verification_stale_source');
const address = getAddress(process.env.SURF_DRAW_RESULTS_ADDRESS || '');
const key = process.env.ETHERSCAN_API_KEY || process.env.BSCSCAN_API_KEY;
if (!key) throw new Error('verification_api_key_required');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--submit')) throw new Error('Unsupported argument');
const endpoint = new URL('https://api.etherscan.io/v2/api');
endpoint.searchParams.set('apikey', key);
endpoint.searchParams.set('chainid', '56');
async function request(fields, post = false) {
  const url = new URL(endpoint);
  if (!post) for (const [name, value] of Object.entries(fields)) url.searchParams.set(name, value);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000),
    ...(post ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ chainid: '56', ...fields }) } : {}) });
  if (!response.ok) throw new Error('verification_provider_unavailable');
  return response.json();
}
async function inspectPublished() {
  const response = await request({ module: 'contract', action: 'getsourcecode', address });
  const record = response.status === '1' && response.result?.[0];
  if (!record?.SourceCode) return false;
  let text = record.SourceCode;
  if (text.startsWith('{{') && text.endsWith('}}')) text = text.slice(1, -1);
  const published = JSON.parse(text);
  if (record.CompilerVersion !== `v${build.compilerVersion}` || Number(record.OptimizationUsed) !== 1 || Number(record.Runs) !== 200 ||
      published.settings?.evmVersion !== config.settings.evmVersion ||
      published.settings?.metadata?.bytecodeHash !== config.settings.metadata.bytecodeHash ||
      Object.keys(published.sources || {}).length !== config.sourceFiles.length ||
      config.sourceFiles.some(file => published.sources?.[file]?.content !== sources[file].content)) {
    throw new Error('verification_published_source_mismatch');
  }
  return true;
}
try {
  let verified = await inspectPublished();
  if (!verified && args.includes('--submit')) {
    const result = await request({ module: 'contract', action: 'verifysourcecode', contractaddress: address,
      sourceCode: inputText, codeformat: 'solidity-standard-json-input', contractname: build.contractName,
      compilerversion: `v${build.compilerVersion}`, optimizationUsed: '1', runs: '200', constructorArguments: '',
      evmVersion: config.settings.evmVersion, licenseType: '3' }, true);
    if (result.status !== '1' || typeof result.result !== 'string') throw new Error('verification_submission_rejected');
    const guid = result.result;
    for (let i = 0; i < 10; i++) {
      const status = await request({ module: 'contract', action: 'checkverifystatus', guid });
      if (status.status === '1') { verified = await inspectPublished(); break; }
      if (!/pending|queue/i.test(String(status.result))) throw new Error('verification_failed');
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
  if (!verified) throw new Error('verification_not_complete');
  const report = { sourceVerified: true, chainId: 56, address, inputSha256: build.inputSha256,
    explorerCodeUrl: `https://bscscan.com/address/${address}#code` };
  if (process.env.DRAW_RESULTS_VERIFICATION_REPORT) await writeFile(process.env.DRAW_RESULTS_VERIFICATION_REPORT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(JSON.stringify({ failed: true, code: /^verification_/.test(error.message) ? error.message : 'verification_validation_failed' }));
  process.exitCode = 1;
}
