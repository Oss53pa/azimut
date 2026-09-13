import { describe, it, expect } from 'vitest';
import {
  guardNamingCollisions,
  type NamedEntity,
} from '../guard-naming.js';

const e = (
  id: string,
  name: string,
  scope = 'site',
  kind = 'door',
): NamedEntity => ({ id, name, scope, kind });

describe('H2.2 — guardNamingCollisions', () => {
  it('passes when every orientation name is unique in scope', () => {
    const r = guardNamingCollisions([e('d-1', 'Porte A'), e('d-2', 'Porte B')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBeNull();
  });

  it('detects two doors "A" on a multi-building site', () => {
    const r = guardNamingCollisions([e('d-1', 'Porte A'), e('d-2', 'Porte A')]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings).toHaveLength(2);
    expect(r.findings[0]?.code).toBe('WAYFIND.NAMING_COLLISION');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('H2.2');
    expect(r.findings[0]?.params['colliding_ids']).toBe('d-1,d-2');
    expect(r.findings.map((f) => f.entity?.id)).toEqual(['d-1', 'd-2']);
  });

  it('compares names case- and whitespace-insensitively', () => {
    const r = guardNamingCollisions([e('d-1', 'Porte A'), e('d-2', 'porte  a')]);
    expect(r.ok).toBe(false);
  });

  it('does not collide across distinct scopes', () => {
    const r = guardNamingCollisions([
      e('d-1', 'Porte A', 'building-1'),
      e('d-2', 'Porte A', 'building-2'),
    ]);
    expect(r.ok).toBe(true);
  });

  it('reports every member of each colliding group, findings sorted by id', () => {
    const r = guardNamingCollisions([
      e('z-2', 'Nord'),
      e('z-1', 'Nord'),
      e('z-3', 'Sud'),
      e('z-4', 'nord'),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.entity?.id)).toEqual(['z-1', 'z-2', 'z-4']);
    expect(r.findings[0]?.params['colliding_ids']).toBe('z-1,z-2,z-4');
  });

  it('is a no-op for an empty list', () => {
    expect(guardNamingCollisions([]).ok).toBe(true);
  });
});
