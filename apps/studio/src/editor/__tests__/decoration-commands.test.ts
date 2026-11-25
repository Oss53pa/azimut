import { describe, it, expect } from 'vitest';
import { inverseCommand } from '@azimut/core-model';
import type { DecorationGeometry, DecorationShape } from '../scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from '../scene-objects.js';
import type { EditorDocument } from '../editor-document.js';
import { applyPatch, emptyDocument } from '../editor-document.js';
import {
  createShapesCommand, defaultLayer, deleteShapesCommand, moveShapesCommand, reorderShapesCommand,
} from '../document-commands.js';
import { decorationCommands, storedGeometry, storedStyle } from '../decoration-commands.js';
import { decorationFromRows, geometryFromStored, shapeFromRow, styleFromStored } from '../decoration-rows.js';

/**
 * S6.1b, décisions Q6 et Q7 — un geste d'habillage devient des commandes de
 * ligne sur `decoration_layer` et `decoration_shape` (0086), et se relit.
 */
const ORG = '0b100000-0000-4000-8000-0000000000a1';
const SITE = '0b100000-0000-4000-8000-0000000000b1';
const LEVEL = '0b100000-0000-4000-8000-0000000000b2';
const TS = '2026-11-25T10:00:00.000Z';
const LAYER = defaultLayer(ORG, SITE, LEVEL);
const WRITE = { orgId: ORG, timestamp: TS, groupKey: null };

const A = '0b100000-0000-4000-8000-0000000000c1';
const B = '0b100000-0000-4000-8000-0000000000c2';
const C = '0b100000-0000-4000-8000-0000000000c3';

function shape(id: string, x: number): DecorationShape {
  return {
    id, orgId: ORG, layerId: LAYER.id, kind: 'area',
    geometry: { type: 'rectangle', origin: { x_m: x, y_m: 0 }, width_m: 1, height_m: 2 },
    styleRole: null, style: DEFAULT_DECORATION_STYLE, label: '', rotation_deg: 0,
  };
}

function translated(doc: EditorDocument, command: ReturnType<typeof createShapesCommand>) {
  if (command === null) throw new Error('geste vide');
  const out = decorationCommands(command, doc.shapes, WRITE);
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  return { commands: out.value, next: applyPatch(doc, command.after) };
}

const empty = emptyDocument(SITE);
const withThree = (() => {
  const { next } = translated(empty, createShapesCommand(empty, [shape(A, 0), shape(B, 2), shape(C, 4)], LAYER, TS));
  return next;
})();

describe('S6.1b — le geste en commandes de ligne', () => {
  it('une première forme crée sa couche, puis elle-même, à son rang', () => {
    const { commands } = translated(empty, createShapesCommand(empty, [shape(A, 0)], LAYER, TS));
    expect(commands.map(c => [c.operation, c.table, c.id])).toEqual([
      ['create', 'decoration_layer', LAYER.id],
      ['create', 'decoration_shape', A],
    ]);
    expect(commands[1]?.after).toEqual({
      id: A, org_id: ORG, layer_id: LAYER.id, kind: 'area',
      geometry: '{"type":"rectangle","origin":{"x_m":0,"y_m":0},"width_m":1,"height_m":2}',
      style_role: null, label: '', rotation_deg: '0', z_order: 0,
      style: '{"fill_role":"decoration.fill","stroke_role":"decoration.stroke","stroke_width_m":0.02,"opacity":1}',
    });
    expect(commands.every(c => c.module === '01-socle' && c.org_id === ORG)).toBe(true);
  });

  it('un déplacement ne porte que la géométrie changée', () => {
    const { commands } = translated(withThree, moveShapesCommand(withThree, [{ id: B, dx_m: 1, dy_m: 0 }], TS));
    expect(commands).toHaveLength(1);
    expect(commands[0]?.operation).toBe('update');
    expect(Object.keys(commands[0]?.before ?? {})).toEqual(['geometry']);
    expect(commands[0]?.after?.['geometry']).toContain('"x_m":3');
  });

  it('un changement d’ordre ne modifie que le rang des formes déplacées', () => {
    const { commands } = translated(withThree, reorderShapesCommand(withThree, [C, B, A], TS));
    expect(commands.map(c => [c.id, c.before, c.after])).toEqual([
      [C, { z_order: 2 }, { z_order: 0 }],
      [A, { z_order: 0 }, { z_order: 2 }],
    ]);
  });

  it('une suppression porte la ligne entière, et les rangs suivants descendent', () => {
    const { commands } = translated(withThree, deleteShapesCommand(withThree, [A], TS));
    expect(commands.map(c => [c.operation, c.id])).toEqual([
      ['update', B], ['update', C], ['delete', A],
    ]);
    expect(commands[2]?.before?.['geometry']).toBeDefined();
    const deletion = commands[2];
    if (deletion === undefined) throw new Error('suppression absente');
    const restored = inverseCommand(deletion, TS);
    expect(restored.operation).toBe('create');
    expect(restored.after).toEqual(commands[2]?.before);
  });

  it('même geste, mêmes commandes (A9)', () => {
    const command = reorderShapesCommand(withThree, [B, C, A], TS);
    expect(translated(withThree, command).commands).toEqual(translated(withThree, command).commands);
  });

  it('l’organisation est celle de la session, jamais celle de la forme', () => {
    const foreign = { ...shape(A, 0), orgId: 'autre' };
    const { commands } = translated(empty, createShapesCommand(empty, [foreign], LAYER, TS));
    expect(commands.map(c => c.after?.['org_id'])).toEqual([ORG, ORG]);
  });
});

describe('S6.1b — la ligne se relit à l’identique', () => {
  const geometries: readonly DecorationGeometry[] = [
    { type: 'polygon', points: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }, { x_m: 0, y_m: 1 }] },
    { type: 'polyline', points: [{ x_m: 0, y_m: 0 }, { x_m: 1.25, y_m: 3 }] },
    { type: 'rectangle', origin: { x_m: -1, y_m: 2 }, width_m: 3, height_m: 4 },
    { type: 'ellipse', center: { x_m: 5, y_m: 5 }, rx_m: 1, ry_m: 0.5 },
    { type: 'symbol_ref', position: { x_m: 2, y_m: 2 }, symbolId: 'arbre.feuillu', scale: 1.5 },
  ];

  it('chaque géométrie, en texte comme relue en objet', () => {
    for (const g of geometries) {
      expect(geometryFromStored(storedGeometry(g))).toEqual(g);
      expect(geometryFromStored(JSON.parse(storedGeometry(g)))).toEqual(g);
    }
  });

  it('le style', () => {
    expect(styleFromStored(storedStyle(DEFAULT_DECORATION_STYLE))).toEqual(DEFAULT_DECORATION_STYLE);
    expect(styleFromStored({ ...JSON.parse(storedStyle(DEFAULT_DECORATION_STYLE)), couleur: 'rouge vif' })).toEqual(DEFAULT_DECORATION_STYLE);
  });

  it('la forme créée, relue depuis les valeurs de sa commande', () => {
    const { commands } = translated(empty, createShapesCommand(empty, [shape(A, 0)], LAYER, TS));
    expect(shapeFromRow(commands[1]?.after ?? {})).toEqual(shape(A, 0));
  });

  it('une ligne illisible ne devient pas une forme, et se compte', () => {
    const row = { id: A, org_id: ORG, layer_id: LAYER.id, kind: 'path', geometry: { type: 'rectangle' }, style: {}, label: '', rotation_deg: 0, style_role: null, z_order: 0 };
    const read = decorationFromRows([], [row]);
    expect(read.shapes).toEqual([]);
    expect(read.unreadable).toBe(1);
  });
});
