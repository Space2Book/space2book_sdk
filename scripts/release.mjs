import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function replaceAlias(base, target) {
  const staging = await mkdtemp(join(base, '.v1-stage-'));
  const next = join(staging, 'next');
  const previous = join(staging, 'previous');
  const alias = join(base, 'v1');
  let movedPrevious = false;
  let installed = false;
  try {
    await cp(target, next, { recursive: true, errorOnExist: true, force: false });
    try {
      await rename(alias, previous);
      movedPrevious = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await rename(next, alias);
      installed = true;
    } catch (error) {
      if (movedPrevious) {
        // Retain the backup if restoration itself fails, rather than deleting it.
        await rename(previous, alias);
        movedPrevious = false;
      }
      throw error;
    }
  } finally {
    if (!movedPrevious || installed) await rm(staging, { recursive: true, force: true });
  }
}

export async function prepareRelease(root = '.', updateAlias = false) {
  const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (!/^1\.\d+\.\d+$/.test(version)) throw new Error('Release requires a stable V1 semver.');
  const base = join(root, 'release/sdk');
  const target = join(base, version);
  const dist = join(root, 'dist');
  await mkdir(base, { recursive: true });
  // Exclusive mkdir: historical versions must never be overwritten.
  await mkdir(target);
  for (const name of await readdir(dist)) await cp(join(dist, name), join(target, name), { recursive: true });
  const manifest = {};
  for (const name of (await readdir(target)).sort()) {
    manifest[name] = 'sha384-' + createHash('sha384').update(await readFile(join(target, name))).digest('base64');
  }
  await writeFile(join(target, 'integrity.json'), JSON.stringify(manifest, null, 2) + '\n');
  // The mutable alias is explicit opt-in. Upload only after verifying the fixed version.
  if (updateAlias) await replaceAlias(base, target);
  return target;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const target = await prepareRelease('.', process.argv.includes('--update-v1'));
  console.log(`Prepared ${target}. No remote publication performed.`);
}
