import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { assembleKioskPackage } from '@azimut/engine-package';
import {
  buildKioskTree,
  buildKioskDataFiles,
  buildKioskMapFiles,
} from '../build-kiosk-tree.js';
import type { KioskAppAssets } from '../build-kiosk-tree.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

const appAssets: KioskAppAssets = {
  indexHtml: enc.encode('<!doctype html><title>Borne</title><div id="app"></div>'),
  appJs: enc.encode('export const boot = () => {};'),
  appCss: enc.encode('body{margin:0;font-family:system-ui}'),
};

describe('D10.1 — buildKioskDataFiles', () => {
  it('produces canonical JSON for graph, directory and scene', () => {
    const data = buildKioskDataFiles(refMultilevel);
    expect([...data.keys()].sort()).toEqual([
      'data/directory.json',
      'data/graph.json',
      'data/scene.json',
      'data/site.json',
    ]);
    // Valid, parseable JSON.
    const graph = JSON.parse(dec.decode(data.get('data/graph.json')));
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
  });

  it('is deterministic (canonical serialization)', () => {
    const a = buildKioskDataFiles(refMultilevel);
    const b = buildKioskDataFiles(refMultilevel);
    for (const key of a.keys()) {
      expect(dec.decode(b.get(key))).toBe(dec.decode(a.get(key)));
    }
  });
});

describe('D10.1 — buildKioskMapFiles', () => {
  it('renders one map per level, named by ordinal', () => {
    const maps = buildKioskMapFiles(refMultilevel);
    expect([...maps.keys()].sort()).toEqual([
      'maps/level-0.svg',
      'maps/level-1.svg',
    ]);
    for (const svg of maps.values()) {
      expect(dec.decode(svg)).toContain('<svg');
    }
  });

  it('map colours come from design tokens (no CSS var references)', () => {
    const svg = dec.decode(buildKioskMapFiles(refMultilevel).get('maps/level-0.svg'));
    expect(svg).not.toContain('var(--');
  });
});

describe('D10.1 — buildKioskTree feeds assembleKioskPackage', () => {
  it('produces a complete, assemblable, autonomous tree', () => {
    const tree = buildKioskTree(refMultilevel, appAssets);

    // All D10.1 required files are present.
    for (const required of [
      'index.html', 'assets/app.js', 'assets/app.css',
      'data/graph.json', 'data/directory.json', 'data/scene.json',
      'maps/level-0.svg',
    ]) {
      expect(tree.has(required)).toBe(true);
    }

    const pkg = assembleKioskPackage({
      siteId: refMultilevel.site.id,
      version: 1,
      builtAt: '2026-09-01T00:00:00Z',
      langs: ['fr', 'en'],
      minRuntime: '1.0.0',
      files: tree,
    });
    expect(pkg.ok).toBe(true);
    if (!pkg.ok) return;
    expect(pkg.value.manifest.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('the whole tree is deterministic', () => {
    const a = buildKioskTree(refMultilevel, appAssets);
    const b = buildKioskTree(refMultilevel, appAssets);
    expect([...a.keys()].sort()).toEqual([...b.keys()].sort());
    for (const key of a.keys()) {
      expect(dec.decode(b.get(key))).toBe(dec.decode(a.get(key)));
    }
  });

  it('includes extra assets (e.g. fonts) under the tree', () => {
    const tree = buildKioskTree(refMultilevel, {
      ...appAssets,
      extra: new Map([['assets/fonts/inter.woff2', enc.encode('FONT')]]),
    });
    expect(tree.has('assets/fonts/inter.woff2')).toBe(true);
  });
});
