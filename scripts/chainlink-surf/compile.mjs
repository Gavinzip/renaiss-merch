import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import solc from 'solc';

const root = fileURLToPath(new URL('../../', import.meta.url));
const files = [
  'contracts/chainlink-surf/ChainlinkSurfDraw.sol',
  'contracts/draw-results/TicketRankSelection.sol',
];
const sources = Object.fromEntries(await Promise.all(files.map(async file =>
  [file, { content: await readFile(path.join(root, file), 'utf8') }])));
const input = JSON.stringify({ language: 'Solidity', sources, settings: {
  optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai',
  metadata: { bytecodeHash: 'ipfs' },
  outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata', 'storageLayout'] } },
} });
if (!solc.version().startsWith('0.8.24+')) throw new Error('Unexpected Solidity compiler');
const output = JSON.parse(solc.compile(input));
const errors = (output.errors || []).filter(item => item.severity === 'error');
if (errors.length) throw new Error(errors.map(item => item.formattedMessage).join('\n'));
const contract = output.contracts[files[0]].ChainlinkSurfDraw;
const manifest = {
  schemaVersion: 1,
  contractName: `${files[0]}:ChainlinkSurfDraw`,
  compilerVersion: solc.version(),
  inputSha256: createHash('sha256').update(input).digest('hex'),
  creationBytecode: `0x${contract.evm.bytecode.object}`,
  deployedBytecodeTemplate: `0x${contract.evm.deployedBytecode.object}`,
  immutableReferences: contract.evm.deployedBytecode.immutableReferences,
  abi: contract.abi,
};
const target = path.join(root, 'shared/chainlink-surf-contract.json');
if (process.argv.includes('--write')) await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
else if (JSON.stringify(JSON.parse(await readFile(target, 'utf8'))) !== JSON.stringify(manifest))
  throw new Error('Chainlink Surf manifest is stale');
console.log(JSON.stringify({ compiled: true, runtimeBytes: contract.evm.deployedBytecode.object.length / 2,
  inputSha256: manifest.inputSha256 }));
