import { describe, it, expect } from 'vitest';
import type { SiteData, TravelProfile } from '@azimut/core-model';
import { allReferenceSites, refCampus, refHealth, refTransit } from '@azimut/testkit';
import { computeRoute } from '../compute-route.js';
import type { Route } from '../compute-route.js';
import { validateGraph } from '../validate-graph.js';

/**
 * C1 — les trois sites de référence qui manquaient au banc : `ref-health`,
 * `ref-transit`, `ref-campus`. Chacun éprouve ce que C1 lui assigne, et T-1.9
 * s'éprouve désormais sur chaque site de référence, comme son acceptation le
 * demande.
 *
 * Un itinéraire introuvable fait échouer l'essai : aucune garde `if (ok)` ne
 * le laisse passer sans rien vérifier.
 */
function profileOf(site: SiteData, key: string): TravelProfile {
  const found = site.travel_profiles.find(p => p.key === key);
  if (found === undefined) throw new Error(`${site.site.id} : profil ${key} absent`);
  return found;
}

function route(site: SiteData, key: string, from: string, to: string): Route {
  const out = computeRoute(site, profileOf(site, key), from, to);
  if (!out.ok) throw new Error(`${site.site.id} : ${from} → ${to} introuvable (${key})`);
  return out.value;
}

const kindOf = (site: SiteData, id: string): string | undefined => site.graph.nodes.find(n => n.id === id)?.kind;
const edgeOf = (site: SiteData, id: string) => site.graph.edges.find(e => e.id === id);

describe('C1 — les trois sites sont valides, sans aucun constat', () => {
  for (const site of [refHealth, refTransit, refCampus]) {
    it(site.site.id, () => {
      const out = validateGraph(site);
      expect(out.ok).toBe(true);
      expect(out.ok ? out.warnings.map(f => f.code) : out.findings.map(f => f.code)).toEqual([]);
    });
  }

  it('le banc porte les sept sites de C1', () => {
    for (const key of ['ref-minimal', 'ref-retail', 'ref-health', 'ref-transit', 'ref-campus', 'ref-broken', 'ref-adversarial']) {
      expect(allReferenceSites.has(key)).toBe(true);
    }
  });
});

/**
 * T-1.9 — « le profil accessible n'emprunte aucune arête non accessible, le
 * profil d'évacuation aucun ascenseur », sur chaque site de référence valide,
 * de chaque entrée à chaque destination.
 */
describe('T-1.9 — les deux propriétés des profils, sur chaque site de référence', () => {
  for (const [key, site] of allReferenceSites) {
    if (!validateGraph(site).ok) continue;
    const entrances = site.graph.nodes.filter(n => n.kind === 'entrance').map(n => n.id);
    const targets = site.destinations.map(d => d.node_id);
    const has = (k: string) => site.travel_profiles.some(p => p.key === k);

    if (has('accessible')) it(`${key} : le profil accessible n'emprunte aucune arête non accessible`, () => {
      let routes = 0;
      for (const from of entrances) for (const to of targets) {
        const out = computeRoute(site, profileOf(site, 'accessible'), from, to);
        if (!out.ok) continue;
        routes += 1;
        for (const id of out.value.edges) expect(edgeOf(site, id)?.accessible).toBe(true);
      }
      expect(routes).toBeGreaterThan(0);
    });

    if (has('evacuation')) it(`${key} : le profil d'évacuation n'emprunte aucun ascenseur`, () => {
      let routes = 0;
      for (const from of entrances) for (const to of targets) {
        const out = computeRoute(site, profileOf(site, 'evacuation'), from, to);
        if (!out.ok) continue;
        routes += 1;
        for (const id of out.value.path) expect(kindOf(site, id)).not.toBe('elevator');
      }
      expect(routes).toBeGreaterThan(0);
    });
  }
});

describe('ref-health — flux séparés, profil brancard', () => {
  it('le brancard monte des urgences à l’hospitalisation sans escalier, par son ascenseur', () => {
    const r = route(refHealth, 'stretcher', 'n-hl-entree-urgences', 'n-hl-chambres');
    expect(r.path.map(id => kindOf(refHealth, id))).not.toContain('stair');
    expect(r.path).toContain('n-hl-asc-brancard-rdc');
    for (const id of r.edges) expect(edgeOf(refHealth, id)?.accessible).toBe(true);
  });

  it('le public et les urgences entrent par deux circulations distinctes', () => {
    const publicRoute = route(refHealth, 'standard', 'n-hl-entree-public', 'n-hl-radio');
    const urgences = route(refHealth, 'standard', 'n-hl-entree-urgences', 'n-hl-urgences');
    expect(publicRoute.path).toContain('n-hl-hall');
    expect(publicRoute.path).not.toContain('n-hl-sas-urgences');
    expect(urgences.path).toContain('n-hl-sas-urgences');
    expect(urgences.path).not.toContain('n-hl-hall');
  });

  it('le service ouvert en continu n’est pas représenté : l’hôpital ne déclare aucun horaire', () => {
    // Limite consignée dans l'en-tête du site et dans la matrice d'avancement.
    expect(refHealth.buildings.find(b => b.id === 'bldg-hl-hopital')?.opening_hours).toBeUndefined();
  });
});

describe('ref-transit — nombreuses issues, bagage, pointes', () => {
  it('six entrées et une issue de secours', () => {
    expect(refTransit.graph.nodes.filter(n => n.kind === 'entrance')).toHaveLength(6);
    expect(refTransit.graph.nodes.filter(n => n.kind === 'emergency_exit')).toHaveLength(1);
  });

  it('le voyageur avec bagage n’emprunte aucun escalier, et les escaliers mécaniques vont dans leur sens', () => {
    const descente = route(refTransit, 'luggage', 'n-tr-entree-nord', 'n-tr-quai-b');
    const montee = route(refTransit, 'luggage', 'n-tr-quai-b', 'n-tr-billetterie');
    for (const r of [descente, montee]) expect(r.path.map(id => kindOf(refTransit, id))).not.toContain('stair');
    expect(descente.edges).toContain('e-tr-descente');
    expect(descente.edges).not.toContain('e-tr-montee');
    expect(montee.edges).toContain('e-tr-montee');
    expect(montee.edges).not.toContain('e-tr-descente');
  });

  it('les capacités des liaisons verticales portent les écarts de charge', () => {
    const capacity = (kind: string) => refTransit.graph.vertical_links.filter(l => l.kind === kind).map(l => l.capacity);
    expect(Math.min(...capacity('escalator'))).toBeGreaterThan(10 * Math.max(...capacity('elevator')));
  });
});

describe('ref-campus — cheminements extérieurs, bâtiments distants', () => {
  it('trois liaisons entre bâtiments, dont deux découvertes, toutes longues de plus de 150 m', () => {
    const links = refCampus.graph.building_links;
    expect(links).toHaveLength(3);
    expect(links.filter(l => !l.sheltered)).toHaveLength(2);
    for (const l of links) expect(edgeOf(refCampus, l.edge_id)?.length_m).toBeGreaterThan(150);
  });

  it('les allées partent d’une empreinte extérieure', () => {
    expect(refCampus.footprints.filter(f => f.kind === 'outdoor')).toHaveLength(1);
  });

  it('des amphithéâtres aux laboratoires : par l’allée découverte, puis l’ascenseur pour le profil accessible', () => {
    const r = route(refCampus, 'accessible', 'n-cp-a-entree', 'n-cp-b-labo');
    expect(r.edges).toContain('e-cp-allee-ab');
    expect(r.path).toContain('n-cp-b-asc-r1');
    expect(r.cost).toBeGreaterThan(200);
  });

  it('de la bibliothèque aux laboratoires : par la galerie couverte', () => {
    const r = route(refCampus, 'standard', 'n-cp-c-entree', 'n-cp-b-hall');
    expect(r.edges).toContain('e-cp-galerie-bc');
  });
});
