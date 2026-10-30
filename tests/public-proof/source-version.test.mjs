import test from 'node:test';
import assert from 'node:assert/strict';
import { captureSourceVersion } from '../../server/source-version.mjs';

const head = '4f34242796f43676233d3cbb70db9d880621164a';
test('a modified checkout never claims its HEAD is the exact running build', () => {
  const version = captureSourceVersion({ environment: { VERCEL_GIT_COMMIT_SHA: '9'.repeat(40) },
    readGit: args => args[0] === 'rev-parse' ? head : '?? uncommitted-feature/' });
  assert.equal(version.sourceCommit, null);
  assert.equal(version.sourceVersion.checkoutHead, head);
  assert.equal(version.sourceVersion.workingTree, 'modified');
  assert.equal(version.sourceVersion.attribution, 'checkout-context-only');
});
test('even a clean checkout identifies source context separately from build identity', () => {
  const version = captureSourceVersion({ environment: {}, readGit: args => args[0] === 'rev-parse' ? head : '' });
  assert.equal(version.sourceCommit, null);
  assert.equal(version.sourceVersion.workingTree, 'clean');
});
test('Vercel reports only a full provider commit and never guesses using a checkout', () => {
  const readGit = () => { throw new Error('Vercel must not inspect a local checkout'); };
  const valid = captureSourceVersion({ environment: { VERCEL: '1', VERCEL_GIT_COMMIT_SHA: head }, readGit });
  assert.equal(valid.sourceCommit, head);
  assert.equal(valid.sourceVersion.attribution, 'provider-reported-git-commit');
  for (const value of ['', '9115165', '$(private)']) {
    const version = captureSourceVersion({ environment: { VERCEL: '1', VERCEL_GIT_COMMIT_SHA: value }, readGit });
    assert.equal(version.sourceCommit, null);
    assert.equal(version.sourceVersion.attribution, 'unavailable');
  }
});
test('missing Git metadata is explicit and does not invent a revision', () => {
  const version = captureSourceVersion({ environment: {}, readGit: () => { throw Error('not a checkout'); } });
  assert.equal(version.sourceCommit, null);
  assert.equal(version.sourceVersion.attribution, 'unavailable');
  assert.equal(version.sourceVersion.workingTree, 'unknown');
  assert.equal(version.sourceVersion.checkoutHead, null);
});
