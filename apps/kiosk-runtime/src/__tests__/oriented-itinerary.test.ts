import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import type { Point } from '@azimut/core-model';
import { computeWayfinding } from '../wayfinding-session.js';
import { orientedItinerary } from '../oriented-itinerary.js';
import type { OrientedItineraryOptions } from '../oriented-itinerary.js';

/**
 * Partie P, écran Itinéraire — le tracé sur le plan orienté de la borne
 * (D10.3, D6.2). Le test décisif est celui de D6.4, porté sur l'itinéraire :
 * une destination devant la borne apparaît dans la moitié haute.
 */
const site = refMultilevel;
const profile = site.travel_profiles.find(p => p.key === 'standard');
if (profile === undefined) throw new Error('profil standard attendu');
const kioskNode = 'n-ml-hall';

const options: OrientedItineraryOptions = {
  width_px: 600, height_px: 600, padding_px: 24, stroke_px: 6, marker_px: 16, duration_s: 6,
  theme: {
    background: 'var(--surface-page)', footprint_fill: 'var(--surface-panel)',
    footprint_stroke: 'var(--border-hairline)', route: 'var(--accent)',
    marker: 'var(--accent)', marker_fill: 'var(--surface-page)',
  },
};

function position(id: string): Point {
  const node = site.graph.nodes.find(n => n.id === id);
  if (node === undefined) throw new Error(`nœud absent : ${id}`);
  return node.position;
}

/** L'azimut (D1.3 : 0 au nord, sens horaire) de `from` vers `to`. */
function bearing(from: Point, to: Point): number {
  const deg = (Math.atan2(to.x_m - from.x_m, to.y_m - from.y_m) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Le centre d'écran d'une marque, ronde ou carrée. */
function markCenter(svg: string, nodeId: string): { readonly x: number; readonly y: number } {
  const tag = new RegExp(`<(circle|rect)[^>]*data-node="${nodeId}"[^>]*>`).exec(svg)?.[0];
  if (tag === undefined) throw new Error(`marque absente : ${nodeId}`);
  const num = (name: string): number => Number(new RegExp(` ${name}="([-\\d.]+)"`).exec(tag)?.[1]);
  if (tag.startsWith('<circle')) return { x: num('cx'), y: num('cy') };
  return { x: num('x') + num('width') / 2, y: num('y') + num('height') / 2 };
}

function wayTo(destinationId: string) {
  const destination = site.destinations.find(d => d.id === destinationId);
  if (destination === undefined) throw new Error(`destination absente : ${destinationId}`);
  const way = computeWayfinding(site, profile as NonNullable<typeof profile>, kioskNode, destination.node_id);
  if (!way.ok) throw new Error('itinéraire attendu');
  return { route: way.value.route, target: destination.node_id };
}

describe('partie P, écran Itinéraire — le tracé sur le plan orienté de la borne', () => {
  const { route, target } = wayTo('dest-ml-rdc');
  const ahead = bearing(position(kioskNode), position(target));

  it('D6.4 — la destination devant la borne est dans la moitié haute, derrière elle dans la basse', () => {
    for (const [azimuth, inFront] of [[ahead, true], [(ahead + 180) % 360, false]] as const) {
      const out = orientedItinerary(site, { nodeId: kioskNode, azimuthDeg: azimuth }, profile, route, options);
      if (!out.ok) throw new Error('rendu attendu');
      const frame = out.value.frames[0];
      expect(frame?.node_ids).toContain(target);
      const end = markCenter(frame?.static_svg ?? '', target);
      const start = markCenter(frame?.static_svg ?? '', kioskNode);
      expect(end.y < start.y).toBe(inFront);
    }
  });

  it('le tracé part de la borne, et chaque tronçon a son équivalent statique, sans mouvement', () => {
    const out = orientedItinerary(site, { nodeId: kioskNode, azimuthDeg: 142 }, profile, route, options);
    if (!out.ok) throw new Error('rendu attendu');
    expect(out.value.frames[0]?.node_ids[0]).toBe(kioskNode);
    expect(out.value.frames[0]?.static_svg).toContain(`data-role="start" data-node="${kioskNode}"`);
    for (const frame of out.value.frames) {
      expect(frame.svg).toContain('<animate');
      expect(frame.static_svg).not.toContain('<animate');
      expect(frame.static_svg).not.toContain('<set');
    }
  });

  it('les points de décision du chemin sont mis en évidence', () => {
    const out = orientedItinerary(site, { nodeId: kioskNode, azimuthDeg: 0 }, profile, route, options);
    if (!out.ok) throw new Error('rendu attendu');
    for (const frame of out.value.frames) {
      for (const id of frame.decision_node_ids) {
        expect(frame.static_svg).toContain(`data-role="decision" data-node="${id}"`);
      }
    }
  });

  it('déterministe : même borne, même chemin, mêmes octets', () => {
    const a = orientedItinerary(site, { nodeId: kioskNode, azimuthDeg: 142 }, profile, route, options);
    const b = orientedItinerary(site, { nodeId: kioskNode, azimuthDeg: 142 }, profile, route, options);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('une borne placée sur un nœud inconnu est refusée (D10.3)', () => {
    const out = orientedItinerary(site, { nodeId: 'nulle-part', azimuthDeg: 0 }, profile, route, options);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.findings[0]?.code).toBe('DATA.KIOSK_CONFIG_INVALID');
  });
});
