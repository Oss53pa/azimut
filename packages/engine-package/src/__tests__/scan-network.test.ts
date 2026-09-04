import { describe, it, expect } from 'vitest';
import { scanForNetworkDependency } from '../scan-network.js';

const enc = new TextEncoder();

function artifactMap(
  entries: Record<string, string>,
): ReadonlyMap<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  for (const [id, content] of Object.entries(entries)) {
    map.set(id, enc.encode(content));
  }
  return map;
}

describe('scanForNetworkDependency', () => {
  it('passes clean artifacts', () => {
    const artifacts = artifactMap({
      'index.html': '<html><body>Hello</body></html>',
      'app.js': 'const x = 42; console.log(x);',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.scanned_count).toBe(2);
    expect(result.value.clean_count).toBe(2);
  });

  it('detects fetch()', () => {
    const artifacts = artifactMap({
      'app.js': 'fetch("https://example.com/data")',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('PACKAGE.NETWORK_DEPENDENCY');
    expect(result.findings[0]?.params['patterns']).toContain('fetch()');
  });

  it('detects XMLHttpRequest', () => {
    const artifacts = artifactMap({
      'legacy.js': 'const xhr = new XMLHttpRequest();',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.params['patterns']).toContain('XMLHttpRequest');
  });

  it('detects WebSocket', () => {
    const artifacts = artifactMap({
      'ws.js': 'const ws = new WebSocket("wss://example.com");',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
  });

  it('detects external script tags', () => {
    const artifacts = artifactMap({
      'page.html': '<script src="https://cdn.example.com/lib.js"></script>',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.params['patterns']).toContain(
      '<script src="http...">',
    );
  });

  it('detects external CSS link', () => {
    const artifacts = artifactMap({
      'page.html': '<link href="https://fonts.googleapis.com/css" rel="stylesheet">',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
  });

  it('detects external image', () => {
    const artifacts = artifactMap({
      'page.html': '<img src="http://tracker.example.com/pixel.png">',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
  });

  it('detects CSS url() with http', () => {
    const artifacts = artifactMap({
      'style.css': 'body { background: url("https://example.com/bg.png"); }',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
  });

  it('detects navigator.sendBeacon', () => {
    const artifacts = artifactMap({
      'analytics.js': 'navigator.sendBeacon("/track", data);',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
  });

  it('detects dynamic import with URL', () => {
    const artifacts = artifactMap({
      'loader.js': 'import("https://example.com/module.js")',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
  });

  it('detects EventSource', () => {
    const artifacts = artifactMap({
      'sse.js': 'const source = new EventSource("/events");',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
  });

  it('reports multiple patterns in one artifact', () => {
    const artifacts = artifactMap({
      'bad.js': 'fetch("/a"); const x = new XMLHttpRequest();',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.length).toBe(1);
    const count = result.findings[0]?.params['pattern_count'];
    expect(count).toBe(2);
  });

  it('reports findings for each offending artifact', () => {
    const artifacts = artifactMap({
      'a.js': 'fetch("/x")',
      'b.js': 'console.log("clean")',
      'c.js': 'new WebSocket("ws://localhost")',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.length).toBe(2);
    const ids = result.findings.map((f) => f.entity?.id);
    expect(ids).toContain('a.js');
    expect(ids).toContain('c.js');
  });

  it('findings are sorted by artifact id', () => {
    const artifacts = artifactMap({
      'z.js': 'fetch("/z")',
      'a.js': 'fetch("/a")',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const ids = result.findings.map((f) => f.entity?.id ?? '');
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('skips binary content', () => {
    const binary = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]);
    const map = new Map<string, Uint8Array>();
    map.set('file.pdf', binary);
    const result = scanForNetworkDependency(map);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.clean_count).toBe(1);
  });

  it('handles empty map', () => {
    const result = scanForNetworkDependency(new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.scanned_count).toBe(0);
    expect(result.value.clean_count).toBe(0);
  });

  it('is deterministic (INV-4)', () => {
    const artifacts = artifactMap({
      'a.js': 'fetch("/x")',
      'b.html': '<script src="https://cdn.test/lib.js"></script>',
    });
    const r1 = scanForNetworkDependency(artifacts);
    const r2 = scanForNetworkDependency(artifacts);
    expect(r1).toStrictEqual(r2);
  });

  it('treats zero-byte artifact as clean', () => {
    const map = new Map<string, Uint8Array>();
    map.set('empty.js', new Uint8Array(0));
    const result = scanForNetworkDependency(map);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.scanned_count).toBe(1);
    expect(result.value.clean_count).toBe(1);
  });

  it('regex lastIndex does not bleed between calls', () => {
    const dirty = artifactMap({
      'a.js': 'fetch("https://example.com/data")',
    });
    const r1 = scanForNetworkDependency(dirty);
    expect(r1.ok).toBe(false);

    const clean = artifactMap({
      'b.js': 'console.log("hello")',
    });
    const r2 = scanForNetworkDependency(clean);
    expect(r2.ok).toBe(true);
  });

  it('scans text when null byte is beyond position 512', () => {
    const prefix = 'fetch("https://example.com/api")';
    const padding = 'x'.repeat(520 - prefix.length);
    const withLateNull = prefix + padding + '\0rest';
    const artifacts = artifactMap({ 'late-null.js': withLateNull });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.params['patterns']).toContain('fetch()');
  });

  it('does not flag local script/link/img tags', () => {
    const artifacts = artifactMap({
      'page.html':
        '<script src="./app.js"></script>' +
        '<link href="style.css" rel="stylesheet">' +
        '<img src="logo.png">',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(true);
  });

  it('pattern labels in findings are sorted alphabetically', () => {
    const artifacts = artifactMap({
      'multi.js': 'new WebSocket("ws://x"); fetch("/a"); new XMLHttpRequest();',
    });
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const patternsStr = result.findings[0]?.params['patterns'] as string;
    expect(patternsStr).toBeDefined();
    const labels = patternsStr.split(', ');
    const sorted = [...labels].sort();
    expect(labels).toEqual(sorted);
  });

  it('empty artifact map passes', () => {
    const artifacts = artifactMap({});
    const result = scanForNetworkDependency(artifacts);
    expect(result.ok).toBe(true);
  });
});
