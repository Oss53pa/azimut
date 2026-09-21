import { describe, it, expect } from 'vitest';
import { createFootprintCommands, seriesVertices, seriesCodes } from '../footprint-commands.js';
import type { FootprintRow, FootprintWrite } from '../footprint-commands.js';
import { acceptFootprint } from '../footprint-input.js';
import type { Point } from '@azimut/core-model';
import { EMPTY_STORE, dispatch, undo } from '../command-store.js';
import type { CommandSink } from '../command-store.js';

const WRITE: FootprintWrite = {
  orgId: 'aaaaaaaa-0000-0000-0000-000000000001',
  levelId: 'level-1',
  timestamp: '2026-09-21T10:00:00.000Z',
};

const SQUARE: readonly Point[] = [
  { x_m: 0, y_m: 0 }, { x_m: 3, y_m: 0 }, { x_m: 3, y_m: 4 }, { x_m: 0, y_m: 4 },
];

function accepted(code: string, vertices: readonly Point[] = SQUARE) {
  const r = acceptFootprint(
    { vertices, unitCode: code, kind: 'cell', categoryId: null },
    { codesOnLevel: [], existing: [] },
  );
  if (!r.ok) throw new Error(r.findings.map(f => f.code).join(','));
  return r.value;
}

function rows(count: number): readonly FootprintRow[] {
  const base = accepted('B01');
  const copies = seriesVertices(base.vertices, { dx_m: 4, dy_m: 0, count: count - 1 });
  const codes = seriesCodes('B01', count - 1);
  return [
    { id: 'fp-1', footprint: base },
    ...copies.map((vertices, i) => ({
      id: `fp-${String(i + 2)}`,
      footprint: accepted(codes[i] ?? 'X', vertices),
    })),
  ];
}

function accepting(): { sink: CommandSink; seen: number[] } {
  const seen: number[] = [];
  const sink: CommandSink = async (commands) => {
    seen.push(commands.length);
    return { ok: true, value: null, warnings: [] };
  };
  return { sink, seen };
}

describe('M3 (partie M) — écriture des empreintes', () => {
  it('n’écrit que la table du module 01', () => {
    const r = createFootprintCommands(rows(1), WRITE, 'geste');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.every(c => c.table === 'footprint' && c.module === '01-socle')).toBe(true);
  });

  it('écrit la géométrie en mètres, quantifiée', () => {
    const r = createFootprintCommands(rows(1), WRITE, 'geste');
    expect(r.ok).toBe(true);
    if (r.ok) {
      const geometry = JSON.parse(String(r.value[0]?.after?.['geometry'])) as { vertices: Point[] };
      expect(geometry.vertices).toEqual(SQUARE);
    }
  });
});

/**
 * M3 (partie M), critère d'acceptation 4 — « La duplication en série de
 * 20 cellules se fait en une commande annulable d'un seul geste. »
 */
describe('M3 (partie M) — duplication en série de vingt cellules', () => {
  it('produit vingt empreintes', () => {
    const r = createFootprintCommands(rows(20), WRITE, 'serie');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.length).toBe(20);
  });

  it('les range sous un seul geste', () => {
    const r = createFootprintCommands(rows(20), WRITE, 'serie');
    expect(r.ok).toBe(true);
    if (r.ok) expect(new Set(r.value.map(c => c.groupKey))).toEqual(new Set(['serie']));
  });

  /**
   * Vingt annulations successives pour défaire une seule action seraient une
   * punition : c'est E5.2 appliqué au cas où il compte le plus.
   */
  it('s’écrit et s’annule d’un seul geste', async () => {
    const r = createFootprintCommands(rows(20), WRITE, 'serie');
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const { sink, seen } = accepting();
    const written = await dispatch(EMPTY_STORE, sink, r.value);
    expect(written.state.undoStack.length).toBe(1);
    expect(seen).toEqual([20]);

    const undone = await undo(written.state, sink, '2026-09-21T10:00:05.000Z');
    expect(undone.outcome.ok).toBe(true);
    expect(undone.state.undoStack.length).toBe(0);
    expect(seen).toEqual([20, 20]);
  });

  /**
   * La vingtième copie ne doit pas accumuler vingt fois l'erreur du pas :
   * chaque copie est calculée depuis l'original, non depuis la précédente.
   */
  it('la trame reste régulière jusqu’à la vingtième copie', () => {
    const copies = seriesVertices(SQUARE, { dx_m: 4.001, dy_m: 0, count: 19 });
    expect(copies.length).toBe(19);
    const last = copies[18]?.[0];
    expect(last?.x_m).toBe(76.019);
  });

  it('dérive des codes distincts, à partir du second', () => {
    expect(seriesCodes('B01', 3)).toEqual(['B01-2', 'B01-3', 'B01-4']);
  });

  it('les vingt codes d’une série sont tous distincts', () => {
    const codes = ['B01', ...seriesCodes('B01', 19)];
    expect(new Set(codes).size).toBe(20);
  });
});
