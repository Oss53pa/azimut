import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { SiteData, TemporaryClosure } from '@azimut/core-model';
import { closureRows, closuresOnDay, closuresOnEvacuation, edgesClosedAt } from '../closure-rows.js';

const [support] = refMultilevel.supports;
if (support === undefined) throw new Error('jeu sans support');
const incident = refMultilevel.graph.edges.find(e => e.from_node_id === support.node_id || e.to_node_id === support.node_id);
const other = refMultilevel.graph.edges.find(e => e.id !== incident?.id);
if (incident === undefined || other === undefined) throw new Error('jeu incomplet');

const base = { org_id: refMultilevel.site.org_id, site_id: refMultilevel.site.id };
/** O11 — une fermeture de travaux sur l'arête du support, une autre, plus tard, ailleurs. */
const WORKS: TemporaryClosure = {
  ...base, id: 'tc-b', edge_ids: [incident.id], from_at: '2026-10-12T00:00:00', to_at: '2026-10-16T23:59:59', reason: 'Travaux',
};
const LATER: TemporaryClosure = {
  ...base, id: 'tc-a', edge_ids: [other.id], from_at: '2026-11-01T00:00:00', to_at: '2026-11-02T00:00:00', reason: 'Salon',
};
const site: SiteData = {
  ...refMultilevel,
  graph: {
    ...refMultilevel.graph,
    edges: refMultilevel.graph.edges.map(e => (e.id === other.id ? { ...e, evacuation_route: true } : { ...e, evacuation_route: false })),
  },
  temporary_closures: [LATER, WORKS],
};

describe('O11 — fermetures temporaires lues pour l’écran', () => {
  it('rend les fermetures du site dans l’ordre de leur début', () => {
    expect(closureRows(site).map(c => c.id)).toEqual(['tc-b', 'tc-a']);
    expect(closureRows(refMultilevel)).toEqual([]);
  });

  it('compte fermées à l’instant les seules arêtes des fermetures en cours', () => {
    expect(edgesClosedAt(site, '2026-10-13T08:00:00').map(e => e.id)).toEqual([incident.id]);
    expect(edgesClosedAt(site, '2026-10-20T08:00:00')).toEqual([]);
  });

  it('trouve la fermeture qui touche un créneau de pose le jour dit, et rien un autre jour', () => {
    expect(closuresOnDay(site, [support.id], '2026-10-14').map(c => c.id)).toEqual(['tc-b']);
    expect(closuresOnDay(site, [support.id], '2026-10-20')).toEqual([]);
    expect(closuresOnDay(site, [], '2026-10-14')).toEqual([]);
  });

  it('signale les fermetures qui portent une arête d’évacuation', () => {
    expect(closuresOnEvacuation(site).map(c => c.id)).toEqual(['tc-a']);
  });
});
