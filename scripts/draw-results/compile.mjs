import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import solc from 'solc';
import { keccak256 } from 'ethers';

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'contracts/draw-results/compiler.json'), 'utf8'));
if (solc.version().split('.Emscripten')[0] !== config.compilerVersion) throw new Error('Unexpected Solidity compiler');
const sources = Object.fromEntries(await Promise.all(config.sourceFiles.map(async file =>
  [file, { content: await readFile(path.join(root, file), 'utf8') }])));
const inputText = JSON.stringify({ language: 'Solidity', sources, settings: config.settings });
const outputText = solc.compile(inputText);
const output = JSON.parse(outputText);
const errors = (output.errors || []).filter(error => error.severity === 'error');
if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join('\n'));
const [file, name] = config.contractName.split(':');
const contract = output.contracts[file][name];
if (Object.keys(contract.evm.deployedBytecode.immutableReferences || {}).length) throw new Error('Runtime must be deterministic');
const manifest = {
  schemaVersion: 1, contractName: config.contractName, compilerVersion: config.compilerVersion,
  inputSha256: createHash('sha256').update(inputText).digest('hex'),
  runtimeHash: keccak256(`0x${contract.evm.deployedBytecode.object}`),
  creationBytecode: `0x${contract.evm.bytecode.object}`, abi: contract.abi,
};
const args = process.argv.slice(2);
if (args.some((arg, i) => !['--check', '--write-manifest', '--out'].includes(arg) && args[i - 1] !== '--out')) throw new Error('Unsupported argument');
const target = path.join(root, 'shared/draw-results-contract.json');
if (args.includes('--check')) {
  if (JSON.stringify(JSON.parse(await readFile(target, 'utf8'))) !== JSON.stringify(manifest)) throw new Error('Draw-results manifest is stale');
}
if (args.includes('--write-manifest')) await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
if (args.includes('--out')) {
  const dir = args[args.indexOf('--out') + 1];
  if (!dir || dir.startsWith('--')) throw new Error('Missing output directory');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'standard-input.json'), inputText);
  await writeFile(path.join(dir, 'standard-output.json'), outputText);
  await writeFile(path.join(dir, 'artifact.json'), `${JSON.stringify({ ...manifest, deployedBytecode: `0x${contract.evm.deployedBytecode.object}` }, null, 2)}\n`);
}
console.log(JSON.stringify({ compiled: true, checked: args.includes('--check'), runtimeBytes: contract.evm.deployedBytecode.object.length / 2,
  creationBytes: contract.evm.bytecode.object.length / 2, runtimeHash: manifest.runtimeHash, inputSha256: manifest.inputSha256 }));
