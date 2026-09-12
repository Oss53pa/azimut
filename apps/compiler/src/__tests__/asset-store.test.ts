import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  memoryAssetStore,
  fileSystemAssetStore,
} from '../asset-store.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

describe('memoryAssetStore', () => {
  const store = memoryAssetStore(
    new Map<string, Uint8Array>([
      ['index.html', enc.encode('<html>')],
      ['assets/app.js', enc.encode('JS')],
      ['assets/fonts/inter.woff2', enc.encode('FONT')],
    ]),
  );

  it('reads a stored asset', async () => {
    expect(dec.decode(await store.read('assets/app.js'))).toBe('JS');
  });

  it('rejects a missing asset', async () => {
    await expect(store.read('assets/missing.js')).rejects.toThrow('Asset not found');
  });

  it('lists a prefix recursively, sorted', async () => {
    expect(await store.list('assets/')).toEqual([
      'assets/app.js',
      'assets/fonts/inter.woff2',
    ]);
  });

  it('rejects an unsafe path', async () => {
    await expect(store.read('../secret')).rejects.toThrow('Unsafe asset path');
    await expect(store.read('/etc/passwd')).rejects.toThrow('Unsafe asset path');
  });
});

describe('fileSystemAssetStore', () => {
  let root = '';

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'azimut-kiosk-'));
    await mkdir(join(root, 'assets', 'fonts'), { recursive: true });
    await writeFile(join(root, 'index.html'), '<html>');
    await writeFile(join(root, 'assets', 'app.js'), 'JS');
    await writeFile(join(root, 'assets', 'app.css'), 'CSS');
    await writeFile(join(root, 'assets', 'fonts', 'inter.woff2'), 'FONT');
  });

  afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('reads a file by tree-relative path', async () => {
    const store = fileSystemAssetStore(root);
    expect(dec.decode(await store.read('index.html'))).toBe('<html>');
    expect(dec.decode(await store.read('assets/fonts/inter.woff2'))).toBe('FONT');
  });

  it('walks the assets prefix recursively with POSIX paths, sorted', async () => {
    const store = fileSystemAssetStore(root);
    expect(await store.list('assets/')).toEqual([
      'assets/app.css',
      'assets/app.js',
      'assets/fonts/inter.woff2',
    ]);
  });

  it('returns [] for a prefix under a non-existent root', async () => {
    const store = fileSystemAssetStore(join(root, 'does-not-exist'));
    expect(await store.list('assets/')).toEqual([]);
  });

  it('rejects an unsafe read path', async () => {
    const store = fileSystemAssetStore(root);
    await expect(store.read('../../etc/passwd')).rejects.toThrow('Unsafe asset path');
  });
});
