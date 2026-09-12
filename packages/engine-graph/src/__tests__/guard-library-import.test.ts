import { describe, it, expect } from 'vitest';
import {
  guardLibraryImport,
  type LibrarySymbol,
} from '../guard-library-import.js';

const sym = (id: string, content: unknown): LibrarySymbol => ({ id, content });

describe('J6.3 — guardLibraryImport', () => {
  it('accepts symbols with no content match in the library', () => {
    const r = guardLibraryImport(
      [sym('in-1', { svg: '<path d="M0 0"/>' })],
      [sym('lib-1', { svg: '<path d="M1 1"/>' })],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('warns when an incoming symbol duplicates existing content, naming it', () => {
    const shared = { svg: '<path d="M0 0L10 10"/>' };
    const r = guardLibraryImport([sym('in-1', shared)], [sym('lib-9', shared)]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]?.code).toBe('LIBRARY.DUPLICATE_ON_IMPORT');
    expect(r.warnings[0]?.severity).toBe('warning');
    expect(r.warnings[0]?.ruleRef).toBe('J6.3');
    expect(r.warnings[0]?.entity).toEqual({ kind: 'library_symbol', id: 'in-1' });
    expect(r.warnings[0]?.params['existing_id']).toBe('lib-9');
  });

  it('matches on content regardless of key order or id', () => {
    const r = guardLibraryImport(
      [sym('in-1', { a: 1, b: 2 })],
      [sym('lib-1', { b: 2, a: 1 })],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toHaveLength(1);
  });

  it('reports one warning per duplicate incoming symbol, sorted by id', () => {
    const c1 = { s: 'one' };
    const c2 = { s: 'two' };
    const r = guardLibraryImport(
      [sym('in-c', c2), sym('in-a', { s: 'fresh' }), sym('in-b', c1)],
      [sym('lib-x', c1), sym('lib-y', c2)],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['in-b', 'in-c']);
  });

  it('names the first existing id (sorted) when the library repeats content', () => {
    const c = { s: 'dup' };
    const r = guardLibraryImport(
      [sym('in-1', c)],
      [sym('lib-z', c), sym('lib-a', c)],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.params['existing_id']).toBe('lib-a');
  });

  it('is a no-op for empty inputs', () => {
    const r = guardLibraryImport([], []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });
});
