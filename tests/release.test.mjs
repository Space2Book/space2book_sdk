import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareRelease } from '../scripts/release.mjs';

test('release refuses historical overwrite and only updates v1 with explicit opt-in', async () => {
  mkdirSync('work', { recursive: true });
  const cwd = mkdtempSync(resolve('work/release-test-'));
  try {
    mkdirSync(cwd + '/dist');
    writeFileSync(cwd + '/dist/space2book.min.js', 'fixture-build');
    writeFileSync(cwd + '/package.json', JSON.stringify({ version: '1.0.0' }));
    await prepareRelease(cwd, true);
    const fixed = cwd + '/release/sdk/1.0.0/space2book.min.js';
    assert.equal(readFileSync(fixed, 'utf8'), 'fixture-build');
    assert.equal(readFileSync(cwd + '/release/sdk/v1/space2book.min.js', 'utf8'), 'fixture-build');
    writeFileSync(cwd + '/dist/space2book.min.js', 'different-build');
    await assert.rejects(prepareRelease(cwd), { code: 'EEXIST' });
    assert.equal(readFileSync(fixed, 'utf8'), 'fixture-build');
    writeFileSync(cwd + '/package.json', JSON.stringify({ version: '1.0.1' }));
    await prepareRelease(cwd);
    assert.equal(readFileSync(cwd + '/release/sdk/v1/space2book.min.js', 'utf8'), 'fixture-build');
    assert.ok(existsSync(cwd + '/release/sdk/1.0.1/integrity.json'));
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
