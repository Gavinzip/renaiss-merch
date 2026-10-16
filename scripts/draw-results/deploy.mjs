import { drawProvider, signerFor } from '../../server/surf-draw/chain.mjs';
import { deployDrawResults } from '../../server/surf-draw/deploy-results.mjs';
import build from '../../shared/draw-results-contract.json' with { type: 'json' };

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--broadcast')) throw new Error('Unsupported argument');
const approvedInputHash = args.includes('--broadcast') ? process.env.DRAW_RESULTS_DEPLOY_APPROVAL : null;
if (args.includes('--broadcast') && approvedInputHash !== build.inputSha256) throw new Error('deployment_approval_required');
const provider = drawProvider();
try { console.log(JSON.stringify(await deployDrawResults({ provider, signer: signerFor(provider),
  journalDir: process.env.DRAW_RESULTS_DEPLOY_JOURNAL_DIR, approvedInputHash }))); }
catch (error) { console.error(JSON.stringify({ failed: true, code: error.code || (/^deployment_/.test(error.message) ? error.message : 'deployment_validation_failed') })); process.exitCode = 1; }
finally { provider.destroy(); }
