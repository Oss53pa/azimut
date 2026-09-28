import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { SiteData, TemporaryClosure } from '@azimut/core-model';
import { computeRoute } from '../compute-route.js';

const profile = refMultilevel.travel_profiles[0];
if (profile === undefined) throw new Error('jeu sans profil');

const entrance = refMultilevel.graph.nodes.find(n => n.kind === 'entrance');
const farthest = [...refMultilevel.graph.nodes].reverse().find(n => n.id !== entrance?.id);
if (entrance === undefined || farthest === undefined) throw new Error('jeu incomplet');
const base = computeRoute(refMultilevel, profile, entrance.id, farthest.id);
if (!base.ok) throw new Error('itinéraire de référence introuvable');

/** O11 — une fermeture de toutes les arêtes de l'itinéraire de référence. */
const WORKS: TemporaryClosure = {
  id: 'tc-1', org_id: refMultilevel.site.org_id, site_id: refMultilevel.site.id,
  edge_ids: base.value.edges, from_at: '2026-10-12T00:00:00', to_at: '2026-10-16T23:59:59', reason: 'Travaux',
};
const closedSite: SiteData = { ...refMultilevel, temporary_closures: [WORKS] };

describe('O11 — fermetures temporaires et itinéraire', () => {
  it('ignore les fermetures sans instant : un rendu durable ne les voit pas', () => {
    const route = computeRoute(closedSite, profile, entrance.id, farthest.id);
    expect(route.ok && route.value.edges).toEqual(base.value.edges);
  });

  it('recalcule sans les arêtes fermées pendant la période, et revient à l’état nominal après', () => {
    const during = computeRoute(closedSite, profile, entrance.id, farthest.id, { at: '2026-10-14T10:00:00' });
    if (during.ok) {
      for (const id of WORKS.edge_ids) expect(during.value.edges).not.toContain(id);
    } else {
      expect(during.findings[0]?.code).toBe('GRAPH.ROUTE_UNREACHABLE');
    }
    const after = computeRoute(closedSite, profile, entrance.id, farthest.id, { at: '2026-10-17T00:00:00' });
    expect(after.ok && after.value.edges).toEqual(base.value.edges);
  });

  it('refuse un instant mal formé : c’est une faute de l’appelant, pas une anomalie du site', () => {
    expect(() => computeRoute(refMultilevel, profile, entrance.id, farthest.id, { at: '2026-10-14T10:00:00Z' }))
      .toThrow(RangeError);
  });
});
