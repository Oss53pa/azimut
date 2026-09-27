import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import { readEdgeAvailability, type Edge, type SiteData } from '@azimut/core-model';
import { computeRoute } from '../compute-route.js';
import { checkEdgeAvailability } from '../checks/edge-availability.js';
import { runChecks } from '../run-checks.js';

const profile = refMultilevel.travel_profiles[0];
if (profile === undefined) throw new Error('jeu sans profil');

const WORKS = { from: '2026-10-12T00:00:00', to: '2026-10-16T23:59:59', reason_key: 'works', declared_by: null };

/** Le site, avec une disponibilité posée sur chaque arête d'un itinéraire de référence. */
function closeEdges(site: SiteData, ids: ReadonlySet<string>, availability: Edge['availability']): SiteData {
  return {
    ...site,
    graph: {
      ...site.graph,
      edges: site.graph.edges.map(e => (ids.has(e.id) && availability !== undefined ? { ...e, availability } : e)),
    },
  };
}

const entrance = refMultilevel.graph.nodes.find(n => n.kind === 'entrance');
const farthest = [...refMultilevel.graph.nodes].reverse().find(n => n.id !== entrance?.id);
if (entrance === undefined || farthest === undefined) throw new Error('jeu incomplet');
const base = computeRoute(refMultilevel, profile, entrance.id, farthest.id);
if (!base.ok) throw new Error('itinéraire de référence introuvable');
const closedSite = closeEdges(refMultilevel, new Set(base.value.edges), readEdgeAvailability({ closures: [WORKS] }));

describe('A5.3 — fermetures et itinéraire', () => {
  it('ignore les fermetures sans instant : un rendu durable ne les voit pas', () => {
    const route = computeRoute(closedSite, profile, entrance.id, farthest.id);
    expect(route.ok && route.value.edges).toEqual(base.value.edges);
  });

  it('écarte à l’instant donné une arête fermée, et la reprend hors de la plage', () => {
    const during = computeRoute(closedSite, profile, entrance.id, farthest.id, { at: '2026-10-14T10:00:00' });
    if (during.ok) expect(during.value.edges).not.toEqual(base.value.edges);
    else expect(during.findings[0]?.code).toBe('GRAPH.ROUTE_UNREACHABLE');
    const after = computeRoute(closedSite, profile, entrance.id, farthest.id, { at: '2026-10-17T00:00:00' });
    expect(after.ok && after.value.edges).toEqual(base.value.edges);
  });

  it('refuse un instant hors du format local du site', () => {
    const route = computeRoute(refMultilevel, profile, entrance.id, farthest.id, { at: '2026-10-14T10:00:00Z' });
    expect(!route.ok && route.findings[0]?.code).toBe('GRAPH.ROUTE_INSTANT_INVALID');
  });
});

describe('A5.3 — contrôle des disponibilités', () => {
  it('ne relève rien sur un site sans fermeture, et se déclare exécuté', () => {
    expect(checkEdgeAvailability(refMultilevel)).toEqual([]);
    const report = runChecks(refMultilevel);
    expect(report.ok && report.value.checks_run).toContain('edge_availability');
  });

  it('bloque une disponibilité illisible', () => {
    const [edge] = refMultilevel.graph.edges;
    if (edge === undefined) throw new Error('jeu sans arête');
    const site = closeEdges(refMultilevel, new Set([edge.id]), { readable: false });
    expect(checkEdgeAvailability(site).map(f => [f.code, f.severity])).toEqual([['GRAPH.EDGE_AVAILABILITY_UNREADABLE', 'blocking']]);
  });

  it('avertit d’une fermeture sur un chemin d’évacuation, et seulement là', () => {
    const [evac, plain] = refMultilevel.graph.edges;
    if (evac === undefined || plain === undefined) throw new Error('jeu sans deux arêtes');
    const availability = readEdgeAvailability({ closures: [WORKS] });
    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        edges: refMultilevel.graph.edges.map(e => {
          if (e.id === evac.id && availability !== undefined) return { ...e, evacuation_route: true, availability };
          if (e.id === plain.id && availability !== undefined) return { ...e, evacuation_route: false, availability };
          return e;
        }),
      },
    };
    const findings = checkEdgeAvailability(site);
    expect(findings.map(f => [f.code, f.severity, f.entity?.id])).toEqual([
      ['GRAPH.EVACUATION_EDGE_CLOSURE', 'warning', evac.id],
    ]);
    expect(findings[0]?.params).toEqual({ from: WORKS.from, to: WORKS.to, reason_key: 'works' });
  });
});
