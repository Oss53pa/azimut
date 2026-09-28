import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import {
  closedEdgesAt, closuresOverlapping, declareClosureCommand, inverseCommand, isLocalInstant,
  localInstantOf, sortClosures, withdrawClosureCommand, type ClosureDraft, type TemporaryClosure,
} from '@azimut/core-model';

const [e1, e2] = refMultilevel.graph.edges;
if (e1 === undefined || e2 === undefined) throw new Error('jeu sans deux arêtes');

const CLOSURE: TemporaryClosure = {
  id: 'tc-1', org_id: refMultilevel.site.org_id, site_id: refMultilevel.site.id,
  edge_ids: [e1.id, e2.id], from_at: '2026-03-03T00:00:00', to_at: '2026-03-17T23:59:59', reason: 'Travaux',
};
const DRAFT: ClosureDraft = {
  edgeIds: [e1.id, e2.id], from: '2026-03-03T00:00:00', to: '2026-03-17T23:59:59', reason: '  Travaux ',
};
const ENV = { newId: () => 'tc-new', timestamp: '2026-09-28T00:00:00.000Z' };

const keys = (draft: ClosureDraft): readonly string[] => {
  const out = declareClosureCommand(refMultilevel, draft, ENV);
  return out.ok ? [] : [...out.findings.map(f => f.code), ...out.notices.map(n => n.key)];
};

describe('O11 — fermetures temporaires', () => {
  it('lit les instants locaux, avec ou sans fractions de seconde', () => {
    expect(isLocalInstant('2026-03-03T00:00:00')).toBe(true);
    expect(isLocalInstant('2026-03-03T00:00:00Z')).toBe(false);
    expect(localInstantOf('2026-03-03T08:30:00.000')).toBe('2026-03-03T08:30:00');
    expect(localInstantOf('2026-03-03 08:30:00')).toBe('2026-03-03T08:30:00');
    expect(localInstantOf('mars')).toBeNull();
  });

  it('ferme toutes ses arêtes pendant la période, bornes incluses, et aucune hors période', () => {
    expect([...closedEdgesAt([CLOSURE], '2026-03-03T00:00:00')]).toEqual([e1.id, e2.id]);
    expect([...closedEdgesAt([CLOSURE], '2026-03-17T23:59:59')]).toEqual([e1.id, e2.id]);
    expect(closedEdgesAt([CLOSURE], '2026-03-18T00:00:00').size).toBe(0);
    expect(closedEdgesAt([CLOSURE], '2026-03-02T23:59:59').size).toBe(0);
  });

  it('trouve les fermetures qui recouvrent une plage, et les trie de façon stable', () => {
    const later = { ...CLOSURE, id: 'tc-0', from_at: '2026-04-01T00:00:00', to_at: '2026-04-02T00:00:00' };
    expect(closuresOverlapping([CLOSURE, later], '2026-03-10T00:00:00', '2026-03-10T23:59:59').map(c => c.id)).toEqual(['tc-1']);
    expect(sortClosures([later, CLOSURE]).map(c => c.id)).toEqual(['tc-1', 'tc-0']);
  });

  it('déclare une fermeture du module 01 sur temporary_closure', () => {
    const out = declareClosureCommand(refMultilevel, DRAFT, ENV);
    if (!out.ok) throw new Error(out.notices.map(n => n.key).join(', '));
    expect(out.value.module).toBe('01-socle');
    expect(out.value.table).toBe('temporary_closure');
    expect(out.value.after).toEqual({
      id: 'tc-new', org_id: refMultilevel.site.org_id, site_id: refMultilevel.site.id,
      edge_ids: JSON.stringify([e1.id, e2.id]), from_at: DRAFT.from, to_at: DRAFT.to, reason: 'Travaux',
    });
  });

  it('refuse, sans code au catalogue, une saisie incomplète ou incohérente', () => {
    expect(keys({ ...DRAFT, edgeIds: [] })).toEqual(['form.closure.edges.required']);
    expect(keys({ ...DRAFT, edgeIds: ['arete-inconnue'] })).toEqual(['form.closure.edge.unknown']);
    expect(keys({ ...DRAFT, to: '2026-03-01T00:00:00' })).toEqual(['form.closure.range.invalid']);
    expect(keys({ ...DRAFT, from: '03/03/2026' })).toEqual(['form.closure.range.invalid']);
    expect(keys({ ...DRAFT, reason: '   ' })).toEqual(['form.closure.reason.required']);
  });

  it('retire une fermeture ; l’inverse la recrée à l’identique', () => {
    const out = withdrawClosureCommand(CLOSURE, ENV.timestamp);
    if (!out.ok) throw new Error('refusé');
    expect(out.value.operation).toBe('delete');
    expect(inverseCommand(out.value, ENV.timestamp).after).toMatchObject({
      id: 'tc-1', edge_ids: JSON.stringify([e1.id, e2.id]), reason: 'Travaux',
    });
  });
});
