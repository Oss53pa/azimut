import { describe, it, expect } from 'vitest';
import { buildCommand } from '../site-commands.js';
import type { CommandDraft } from '../site-commands.js';

/**
 * QI5 et QI7, décisions d'Oss53pa du 27 novembre 2026 — le wayfinding crée la
 * ligne `support`, identité et registre compris ; la signalétique n'en écrit
 * que les cotes, ensuite.
 */
const ORG = 'org-1';
const base = { table: 'support', id: 'sup-1', org_id: ORG, timestamp: '2026-11-27T10:00:00.000Z' } as const;
const identity = { id: 'sup-1', org_id: ORG, site_id: 'site-1' };
const implantation = { code: 'D-001', node_id: 'n-1', typology_id: 'typ-1', azimuth_deg: '90', registry: 'wayfinding' };

const faults = (draft: CommandDraft): readonly string[] => {
  const out = buildCommand(draft);
  return out.ok ? [] : out.findings.map(f => `${f.code}:${String(f.params['column'] ?? '')}`);
};

describe('L0 — la création d’un support', () => {
  it('le wayfinding crée la ligne, identité, implantation et registre', () => {
    expect(faults({ ...base, operation: 'create', module: '02-wayfinding', after: { ...identity, ...implantation } })).toEqual([]);
  });

  it('le wayfinding n’écrit pas les cotes, même à la création', () => {
    expect(faults({ ...base, operation: 'create', module: '02-wayfinding', after: { ...identity, ...implantation, width_mm: 600 } }))
      .toEqual(['EDIT.TABLE_NOT_OWNED:width_mm']);
  });

  it('la signalétique ne crée pas de support, et n’écrit pas le registre', () => {
    expect(faults({ ...base, operation: 'create', module: '04-signaletique', after: { ...identity } }))
      .toEqual(['EDIT.TABLE_NOT_OWNED:id', 'EDIT.TABLE_NOT_OWNED:org_id', 'EDIT.TABLE_NOT_OWNED:site_id']);
    expect(faults({ ...base, operation: 'update', module: '04-signaletique', before: { registry: 'wayfinding' }, after: { registry: 'safety' } }))
      .toEqual(['EDIT.TABLE_NOT_OWNED:registry']);
  });

  it('la signalétique écrit les cotes ensuite', () => {
    expect(faults({ ...base, operation: 'update', module: '04-signaletique', before: { width_mm: null }, after: { width_mm: 600 } })).toEqual([]);
  });

  it('l’identité ne se modifie jamais, même par le module qui l’a écrite', () => {
    expect(faults({ ...base, operation: 'update', module: '02-wayfinding', before: { site_id: 'site-1' }, after: { site_id: 'site-2' } }))
      .toEqual(['EDIT.TABLE_NOT_OWNED:site_id']);
  });
});
