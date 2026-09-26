import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import { readEdgeAvailability, type SiteData } from '@azimut/core-model';
import { closureRows, closuresOnDay, edgesClosedAt } from '../closure-rows.js';

const WORKS = { from: '2026-10-12T00:00:00', to: '2026-10-16T23:59:59', reason_key: 'works', declared_by: null };
const [support] = refMultilevel.supports;
if (support === undefined) throw new Error('jeu sans support');
const incident = refMultilevel.graph.edges.find(e => e.from_node_id === support.node_id || e.to_node_id === support.node_id);
const other = refMultilevel.graph.edges.find(e => e.id !== incident?.id);
if (incident === undefined || other === undefined) throw new Error('jeu incomplet');

const site: SiteData = {
  ...refMultilevel,
  graph: {
    ...refMultilevel.graph,
    edges: refMultilevel.graph.edges.map(e => {
      const works = readEdgeAvailability({ closures: [WORKS] });
      if (e.id === incident.id && works !== undefined) return { ...e, availability: works };
      if (e.id === other.id) return { ...e, availability: { readable: false } };
      return e;
    }),
  },
};

describe('A5.3 — fermetures lues pour l’écran', () => {
  it('rend une ligne par fermeture et une par disponibilité illisible', () => {
    const rows = closureRows(site);
    expect(rows).toHaveLength(2);
    expect(rows.filter(r => r.closure === null).map(r => r.edge.id)).toEqual([other.id]);
  });

  it('compte fermées à l’instant les arêtes de la plage et les illisibles', () => {
    expect(edgesClosedAt(site, '2026-10-13T08:00:00').map(e => e.id).sort()).toEqual([incident.id, other.id].sort());
    expect(edgesClosedAt(site, '2026-11-01T08:00:00').map(e => e.id)).toEqual([other.id]);
  });

  it('trouve la fermeture qui touche un créneau de pose le jour dit, et rien un autre jour', () => {
    const onDay = closuresOnDay(site, [support.id], '2026-10-14');
    expect(onDay.some(r => r.edge.id === incident.id && r.closure?.reason_key === 'works')).toBe(true);
    expect(closuresOnDay(site, [support.id], '2026-10-20').filter(r => r.closure !== null)).toHaveLength(0);
    expect(closuresOnDay(site, [], '2026-10-14')).toHaveLength(0);
  });
});
