import { describe, it, expect } from 'vitest';
import type { Footprint, GraphNode, Level } from '@azimut/core-model';
import { orientationDegForAzimuth } from '@azimut/core-model';
import { renderRouteAnimation } from '../route-animation.js';
import type { RouteAnimationOptions } from '../route-animation.js';

function node(id: string, level_id: string, x_m: number, y_m: number, kind: GraphNode['kind'] = 'junction'): GraphNode {
  return { id, org_id: 'o', level_id, kind, position: { x_m, y_m }, label: '' };
}

function level(id: string, ordinal: number): Level {
  return { id, org_id: 'o', building_id: 'b', name: id, ordinal, elevation_m: ordinal * 4 };
}

const footprint = {
  id: 'f0', org_id: 'o', level_id: 'n0', kind: 'cell', unit_code: 'A1',
  geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 40, y_m: 0 }, { x_m: 40, y_m: 20 }, { x_m: 0, y_m: 20 }] },
} as unknown as Footprint;

const scene = {
  levels: [level('n0', 0), level('n1', 1)],
  footprints: [footprint],
  nodes: [
    node('entree', 'n0', 0, 10, 'entrance'),
    node('carrefour', 'n0', 20, 10),
    node('ascenseur-0', 'n0', 30, 10, 'elevator'),
    node('ascenseur-1', 'n1', 30, 10, 'elevator'),
    node('boutique', 'n1', 30, 2),
  ],
};

const options: RouteAnimationOptions = {
  width_px: 400, height_px: 240, padding_px: 16, stroke_px: 4, marker_px: 12, duration_s: 6,
  theme: { background: 'var(--fond)', footprint_fill: 'var(--empreinte)', footprint_stroke: 'var(--bord)', route: 'var(--trace)', marker: 'var(--marque)', marker_fill: 'var(--marque-fond)' },
};

const route = { path: ['entree', 'carrefour', 'ascenseur-0', 'ascenseur-1', 'boutique'] };

describe('A7.3 et L3.1 — le parcours animé', () => {
  it('un tronçon par niveau traversé, et le changement de niveau rendu à part', () => {
    const out = renderRouteAnimation(route, scene, ['carrefour'], options);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.frames.map(f => f.level_id)).toEqual(['n0', 'n1']);
    expect(out.value.level_changes).toEqual([
      { from_level_id: 'n0', to_level_id: 'n1', exit_node_id: 'ascenseur-0', entry_node_id: 'ascenseur-1' },
    ]);
  });

  it('la durée se répartit au prorata des longueurs, et le tracé avance', () => {
    const out = renderRouteAnimation(route, scene, ['carrefour'], options);
    if (!out.ok) throw new Error('rendu attendu');
    const [ground, upper] = out.value.frames;
    expect(ground?.length_m).toBe(30);
    expect(upper?.length_m).toBe(8);
    expect((ground?.dur_s ?? 0) + (upper?.dur_s ?? 0)).toBeCloseTo(6, 2);
    expect(upper?.begin_s).toBeCloseTo(ground?.dur_s ?? 0, 2);
    expect(ground?.svg).toContain('<animate attributeName="stroke-dashoffset"');
  });

  it('le point de décision apparaît quand le tracé l’atteint ; départ, arrivée et niveaux ont leur marque', () => {
    const out = renderRouteAnimation(route, scene, ['carrefour'], options);
    if (!out.ok) throw new Error('rendu attendu');
    const [ground, upper] = out.value.frames;
    expect(ground?.decision_node_ids).toEqual(['carrefour']);
    // Le carrefour est aux deux tiers du tronçon : il apparaît aux deux tiers de sa durée.
    const begin = /data-role="decision" data-node="carrefour"[^>]*><set attributeName="visibility" to="visible" begin="([0-9.]+)s"\/>/
      .exec(ground?.svg ?? '')?.[1];
    expect(Number(begin)).toBeCloseTo(((ground?.dur_s ?? 0) * 20) / 30, 2);
    expect(ground?.svg).toContain('data-role="start" data-node="entree"');
    expect(ground?.svg).toContain('data-role="level_exit" data-node="ascenseur-0"');
    expect(upper?.svg).toContain('data-role="level_entry" data-node="ascenseur-1"');
    expect(upper?.svg).toContain('data-role="end" data-node="boutique"');
  });

  it('l’équivalent statique porte tout, sans mouvement', () => {
    const out = renderRouteAnimation(route, scene, ['carrefour'], options);
    if (!out.ok) throw new Error('rendu attendu');
    for (const frame of out.value.frames) {
      expect(frame.static_svg).not.toContain('<animate');
      expect(frame.static_svg).not.toContain('<set');
      expect(frame.static_svg).not.toContain('visibility="hidden"');
      expect(frame.static_svg).toContain('data-role="route"');
    }
  });

  it('aucun texte dans le rendu : l’interface nomme les marques', () => {
    const out = renderRouteAnimation(route, scene, ['carrefour'], options);
    if (!out.ok) throw new Error('rendu attendu');
    for (const frame of out.value.frames) {
      expect(frame.svg).not.toContain('<text');
      expect(frame.static_svg).not.toContain('<text');
    }
  });

  it('déterministe : deux rendus du même état sont identiques à l’octet', () => {
    const a = renderRouteAnimation(route, scene, ['carrefour'], options);
    const b = renderRouteAnimation(route, { ...scene, nodes: [...scene.nodes].reverse() }, ['carrefour'], options);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('un nœud du parcours absent de la scène est refusé', () => {
    const out = renderRouteAnimation({ path: ['entree', 'fantome'] }, scene, [], options);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.findings[0]?.code).toBe('GRAPH.ROUTE_NODE_NOT_FOUND');
  });
});

/** La position d'écran d'une marque, lue sur son centre. */
function markAt(svg: string, nodeId: string): { readonly x: number; readonly y: number } {
  const circle = new RegExp(`data-node="${nodeId}"[^>]*cx="([-\\d.]+)" cy="([-\\d.]+)"`).exec(svg);
  if (circle === null) throw new Error(`marque absente : ${nodeId}`);
  return { x: Number(circle[1]), y: Number(circle[2]) };
}

describe('D6.2 — le parcours sur un plan orienté', () => {
  // Entrée en (0, 10), carrefour en (20, 10) : le carrefour, point de
  // décision, est à l'est de l'usager.
  const ground = { path: ['entree', 'carrefour', 'ascenseur-0'] };
  const facing = (azimuth: number): RouteAnimationOptions => ({
    ...options,
    orientation: { center: { x_m: 0, y_m: 10 }, orientation_deg: orientationDegForAzimuth(azimuth) },
  });

  it('D6.4 — ce qui est devant l’usager est en haut, quel que soit son azimut', () => {
    for (const [azimuth, ahead] of [[90, true], [270, false]] as const) {
      const out = renderRouteAnimation(ground, scene, ['carrefour'], facing(azimuth));
      if (!out.ok) throw new Error('rendu attendu');
      const svg = out.value.frames[0]?.static_svg ?? '';
      const start = markAt(svg, 'entree');
      const east = markAt(svg, 'carrefour');
      // Tourné vers l'est, le carrefour est devant, donc plus haut sur l'écran.
      expect(east.y < start.y).toBe(ahead);
    }
  });

  it('sans orientation, le nord est en haut et l’est à droite', () => {
    const out = renderRouteAnimation(ground, scene, ['carrefour'], options);
    if (!out.ok) throw new Error('rendu attendu');
    const svg = out.value.frames[0]?.static_svg ?? '';
    expect(markAt(svg, 'carrefour').x).toBeGreaterThan(markAt(svg, 'entree').x);
  });

  it('l’orientation d’azimut nul est le plan nord en haut, à l’octet', () => {
    const plain = renderRouteAnimation(route, scene, ['carrefour'], options);
    const north = renderRouteAnimation(route, scene, ['carrefour'], facing(0));
    expect(JSON.stringify(north)).toBe(JSON.stringify(plain));
  });
});
