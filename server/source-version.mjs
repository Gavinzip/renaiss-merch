import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fullSha = /^[0-9a-f]{40}$/i;
function readCheckoutGit(args) {
  const environment = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete environment[key];
  return execFileSync('git', args, { cwd: root, env: environment, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000, maxBuffer: 1024 * 1024 }).trim();
}

// Capture once when the handler loads. A checkout HEAD is context, not the
// identity of uncommitted code or an independently built/cached frontend.
export function captureSourceVersion({ environment = process.env, readGit = readCheckoutGit } = {}) {
  const capturedAt = new Date().toISOString();
  if (environment.VERCEL === '1') {
    const commit = environment.VERCEL_GIT_COMMIT_SHA?.trim();
    return { sourceCommit: fullSha.test(commit ?? '') ? commit.toLowerCase() : null,
      sourceVersion: { kind: 'vercel-deployment', attribution: fullSha.test(commit ?? '') ? 'provider-reported-git-commit' : 'unavailable',
        checkoutHead: null, workingTree: null, capturedAt } };
  }
  try {
    const checkoutHead = readGit(['rev-parse', 'HEAD']);
    if (!fullSha.test(checkoutHead)) throw new Error('invalid_checkout_head');
    const modified = Boolean(readGit(['status', '--porcelain=v1', '--untracked-files=normal']));
    return { sourceCommit: null, sourceVersion: { kind: 'local-checkout', attribution: 'checkout-context-only',
      checkoutHead: checkoutHead.toLowerCase(), workingTree: modified ? 'modified' : 'clean', capturedAt } };
  } catch {
    return { sourceCommit: null, sourceVersion: { kind: 'local-checkout', attribution: 'unavailable',
      checkoutHead: null, workingTree: 'unknown', capturedAt } };
  }
}
