import { describe, it, expect } from 'vitest';
import {
  declareClosureCommand, withdrawClosureCommand, serializeEdgeAvailability, readEdgeAvailability,
  inverseCommand, type Edge,
} from '../index.js';

const EDGE: Edge = {
  id: 'e-1', org_id: 'o-1', from_node_id: 'n-1', to_node_id: 'n-2', width_m: 2, slope_pct: 0,
  accessible: true, direction: 'both', evacuation_route: false, length_m: 10,
};
const DRAFT = { from: '2026-10-12T00:00:00', to: '2026-10-16T23:59:59', reason_key: 'works' };
const ENV = { timestamp: '2026-09-26T10:00:00Z', declaredBy: null };
const LATER = { from: '2026-11-01T08:00:00', to: '2026-11-01T18:00:00', reason_key: 'event', declared_by: 'm-1' };

function withClosures(value: unknown): Edge {
  const availability = readEdgeAvailability(value);
  return availability === undefined ? EDGE : { ...EDGE, availability };
}

describe('A5.3 — saisie d’une fermeture', () => {
  it('déclare une fermeture par une commande update du module 01 sur edge.availability', () => {
    const out = declareClosureCommand(EDGE, DRAFT, ENV);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value).toMatchObject({ operation: 'update', module: '01-socle', table: 'edge', id: 'e-1', org_id: 'o-1' });
    expect(out.value.before).toEqual({ availability: null });
    const after = out.value.after?.['availability'];
    expect(typeof after === 'string' && readEdgeAvailability(JSON.parse(after))).toEqual({
      readable: true, closures: [{ ...DRAFT, declared_by: null }],
    });
  });

  it('écrit les fermetures triées, à l’identique quel que soit l’ordre de déclaration', () => {
    const a = serializeEdgeAvailability([LATER, { ...DRAFT, declared_by: null }]);
    const b = serializeEdgeAvailability([{ ...DRAFT, declared_by: null }, LATER]);
    expect(a).toBe(b);
    expect(serializeEdgeAvailability([])).toBeNull();
  });

  it('refuse des bornes illisibles ou inversées, et un motif hors liste', () => {
    const codes = (d: typeof DRAFT): readonly string[] => {
      const out = declareClosureCommand(EDGE, d, ENV);
      return out.ok ? [] : out.findings.map(f => f.code);
    };
    expect(codes({ ...DRAFT, from: '12/10/2026' })).toEqual(['GRAPH.CLOSURE_RANGE_INVALID']);
    expect(codes({ ...DRAFT, to: '2026-10-01T00:00:00' })).toEqual(['GRAPH.CLOSURE_RANGE_INVALID']);
    expect(codes({ ...DRAFT, reason_key: 'pluie' })).toEqual(['GRAPH.CLOSURE_REASON_UNKNOWN']);
  });

  it('refuse un doublon, et toute réécriture d’une disponibilité illisible', () => {
    const edge = withClosures({ closures: [{ ...DRAFT, declared_by: 'm-2' }] });
    const dup = declareClosureCommand(edge, DRAFT, ENV);
    expect(!dup.ok && dup.findings.map(f => f.code)).toEqual(['GRAPH.CLOSURE_DUPLICATE']);
    const unreadable = withClosures({ closures: 'x' });
    const out = declareClosureCommand(unreadable, DRAFT, ENV);
    expect(!out.ok && out.findings.map(f => f.code)).toEqual(['GRAPH.CLOSURE_AVAILABILITY_UNREADABLE']);
  });

  it('retire une fermeture, et l’inverse de la commande la rétablit', () => {
    const edge = withClosures({ closures: [LATER, { ...DRAFT, declared_by: null }] });
    const out = withdrawClosureCommand(edge, LATER, ENV.timestamp);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.after).toEqual({ availability: serializeEdgeAvailability([{ ...DRAFT, declared_by: null }]) });
    expect(inverseCommand(out.value, ENV.timestamp).after).toEqual(out.value.before);
    const gone = withdrawClosureCommand(EDGE, LATER, ENV.timestamp);
    expect(!gone.ok && gone.findings.map(f => f.code)).toEqual(['GRAPH.CLOSURE_NOT_FOUND']);
  });

  it('vide la colonne quand la dernière fermeture est retirée', () => {
    const edge = withClosures({ closures: [LATER] });
    const out = withdrawClosureCommand(edge, LATER, ENV.timestamp);
    expect(out.ok && out.value.after).toEqual({ availability: null });
  });
});
