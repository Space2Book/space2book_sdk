import { resolve } from 'node:path';

/** Wildcard binding is explicit and intended only inside an isolated container. */
export function phpServerArguments(env) {
  const bind = env.S2B_TEST_PHP_BIND ?? '127.0.0.1';
  if (bind !== '127.0.0.1' && bind !== '0.0.0.0') {
    throw new TypeError('S2B_TEST_PHP_BIND must be 127.0.0.1 or an explicit 0.0.0.0 for an isolated container.');
  }
  return ['-S', `${bind}:8097`, resolve('tests/backend/router.php')];
}
