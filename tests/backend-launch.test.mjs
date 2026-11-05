import assert from 'node:assert/strict';
import { test } from 'node:test';
import { phpServerArguments } from './backend/php-launch.mjs';

test('native fixture launch stays on loopback; container wildcard requires an explicit opt-in', () => {
  assert.equal(phpServerArguments({})[1], '127.0.0.1:8097');
  assert.equal(phpServerArguments({ S2B_TEST_PHP_EXTERNAL: '0' })[1], '127.0.0.1:8097');
  assert.equal(phpServerArguments({ S2B_TEST_PHP_BIND: '0.0.0.0' })[1], '0.0.0.0:8097');
  for (const bind of ['', '::', '*', '192.0.2.1', '0.0.0.0:8097']) {
    assert.throws(() => phpServerArguments({ S2B_TEST_PHP_BIND: bind }), TypeError);
  }
});
