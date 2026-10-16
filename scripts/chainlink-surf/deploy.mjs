import { ContractFactory, FetchRequest, JsonRpcProvider, Wallet, formatEther, keccak256 } from 'ethers';
import build from '../../shared/chainlink-surf-contract.json' with { type: 'json' };
import { SURF_CHAINLINK_DRAW_ID, SURF_DRAW_CHAIN_ID } from '../../server/surf-draw/model.mjs';

const deploy = process.argv.includes('--deploy');
if (process.argv.slice(2).some(arg => !['--deploy'].includes(arg))) throw new Error('Unsupported argument');
if (process.env.SURF_CHAINLINK_SOURCE_ADDRESS) throw new Error('Chainlink Surf source is already configured');
const rpc = process.env.SURF_DRAW_RPC_URL?.trim();
if (!rpc?.startsWith('https://')) throw new Error('SURF_DRAW_RPC_URL is required');
const request = new FetchRequest(rpc);
request.timeout = 15_000;
const provider = new JsonRpcProvider(request, SURF_DRAW_CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });
try {
  if (Number(await provider.send('eth_chainId', [])) !== SURF_DRAW_CHAIN_ID) throw new Error('Wrong chain');
  const key = process.env.SURF_DRAW_OPERATOR_PRIVATE_KEY?.trim();
  if (!key) throw new Error('Operator signer is not configured');
  const signer = new Wallet(key, provider);
  const factory = new ContractFactory(build.abi, build.creationBytecode, signer);
  const tx = await factory.getDeployTransaction(SURF_CHAINLINK_DRAW_ID);
  const [estimate, fee, balance] = await Promise.all([
    provider.estimateGas({ ...tx, from: signer.address }), provider.getFeeData(), provider.getBalance(signer.address),
  ]);
  if (!fee.gasPrice) throw new Error('BSC gas price unavailable');
  const gasLimit = estimate * 120n / 100n;
  const budget = gasLimit * fee.gasPrice;
  if (budget > 1_000_000_000_000_000n || balance < budget) throw new Error('Deployment gas budget exceeded');
  console.log(JSON.stringify({ action: deploy ? 'deploy' : 'estimate', signer: signer.address,
    drawId: SURF_CHAINLINK_DRAW_ID, gasLimit: gasLimit.toString(), gasPriceWei: fee.gasPrice.toString(),
    maxCostBnb: formatEther(budget), runtimeTemplateSha256: build.inputSha256 }));
  if (!deploy) process.exit(0);
  const nonce = await provider.getTransactionCount(signer.address, 'pending');
  if (nonce !== await provider.getTransactionCount(signer.address, 'latest')) throw new Error('Pending signer transaction');
  const response = await signer.sendTransaction({ ...tx, chainId: SURF_DRAW_CHAIN_ID,
    type: 0, gasPrice: fee.gasPrice, gasLimit, nonce });
  const receipt = await response.wait(1);
  if (!receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error('Deployment transaction failed');
  const code = await provider.getCode(receipt.contractAddress);
  if (code === '0x') throw new Error('Deployed source has no runtime');
  console.log(JSON.stringify({ deployed: true, address: receipt.contractAddress,
    runtimeHash: keccak256(code), txHash: response.hash, block: receipt.blockNumber }));
} finally { provider.destroy(); }
