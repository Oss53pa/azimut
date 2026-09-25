/**
 * Stationnement au plan de niveau — section S8.
 *
 * Fichier distinct du reste des essais de `renderFloorPlan` : les deux réunis
 * dépassaient les quatre cents lignes qu'un fichier du dépôt ne franchit pas
 * sans découpage (A2.4). La coupure suit la matière, elle ne coupe pas au
 * milieu d'un sujet.
 *
 * Ce qu'ils éprouvaient a changé d'objets, pas de sens. Le plan ne dessine plus
 * l'emprise d'une table `parking` : il dessine les empreintes de place qu'une
 * zone de nature `parking` déclare, et distingue celles qu'un fait marque non
 * numérisées (S-37). Les deux cas que les anciens essais tenaient — l'ordre des
 * couches et le cadrage de ce qui déborde du bâti — sont tenus ici sur les
 * nouveaux objets.
 */
import { describe, it, expect } from 'vitest';
import { renderFloorPlan } from '../render-floor-plan.js';
import type { FloorPlanOptions, FloorPlanTheme } from '../render-floor-plan.js';
import type { Footprint, SiteZone, SiteFact, SiteData } from '@azimut/core-model';
import { PARKING_UNDIGITIZED_SPACES_KEY } from '@azimut/core-model';
import { refMultilevel } from '@azimut/testkit';

const theme: FloorPlanTheme = {
  background: 'tok-bg',
  footprint_fill: 'tok-fp-fill',
  footprint_stroke: 'tok-fp-stroke',
  parking_fill: 'tok-park-fill',
  parking_stroke: 'tok-park-stroke',
  uncovered_fill: 'tok-unc-fill',
  uncovered_stroke: 'tok-unc-stroke',
  edge_stroke: 'tok-edge',
  edge_evacuation_stroke: 'tok-evac',
  node_fill: 'tok-node',
  node_stroke: 'tok-node-stroke',
  node_safety_fill: 'tok-safety',
  text_primary: 'tok-txt',
  text_secondary: 'tok-txt2',
};

const defaultOptions: FloorPlanOptions = {
  width_px: 800,
  height_px: 600,
  theme,
  font_family: 'Helvetica',
  show_destinations: true,
  show_edges: true,
  padding_px: 20,
};

const RDC = 'lvl-ml-rdc';

function place(id: string, x: number, y: number, side = 10): Footprint {
  return {
    id,
    org_id: 'org-test-001',
    level_id: RDC,
    geometry: {
      vertices: [
        { x_m: x, y_m: y }, { x_m: x + side, y_m: y },
        { x_m: x + side, y_m: y + side }, { x_m: x, y_m: y + side },
      ],
    },
    kind: 'parking_space',
  };
}

function parkingZone(footprintIds: readonly string[]): SiteZone {
  return {
    id: 'zone-park-1',
    org_id: 'org-test-001',
    level_id: RDC,
    name: 'Ouest',
    kind: 'parking',
    footprint_ids: [...footprintIds],
  };
}

function marque(footprintId: string): SiteFact {
  return {
    key: PARKING_UNDIGITIZED_SPACES_KEY,
    value: 40,
    status: 'existing',
    source_ref: 'Plan coupé au bord de page',
    declared_at: '2026-01-05',
    target: { kind: 'footprint', id: footprintId },
    forbidden: [],
  };
}

/**
 * `refMultilevel` porte déjà un parking conforme. Ces essais posent le leur, et
 * repartent donc d'un site sans zone ni place, pour que chaque cas se lise
 * seul.
 */
function site(extra: Partial<SiteData>): SiteData {
  return {
    ...refMultilevel,
    zones: [],
    footprints: refMultilevel.footprints.filter(f => f.kind !== 'parking_space'),
    ...extra,
  };
}

describe('les places d’un parking', () => {
  const p1 = place('fp-p1', -20, -20);

  it('les dessine avant les empreintes : le parking est le sol', () => {
    const r = renderFloorPlan(
      site({ zones: [parkingZone(['fp-p1'])], footprints: [
        ...refMultilevel.footprints.filter(f => f.kind !== 'parking_space'), p1,
      ] }),
      RDC, defaultOptions,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const park = r.value.indexOf('tok-park-fill');
    const fp = r.value.indexOf('tok-fp-fill');
    expect(park).toBeGreaterThan(-1);
    expect(park).toBeLessThan(fp);
  });

  it('cadre le plan sur elles, quand elles débordent du bâti', () => {
    // Sans les places dans les bornes, elles sortiraient du cadre sans un mot.
    const loin = place('fp-loin', -400, -400);
    const sans = renderFloorPlan(site({}), RDC, defaultOptions);
    const avec = renderFloorPlan(
      site({ zones: [parkingZone(['fp-loin'])], footprints: [
        ...refMultilevel.footprints.filter(f => f.kind !== 'parking_space'), loin,
      ] }),
      RDC, defaultOptions,
    );
    expect(sans.ok && avec.ok).toBe(true);
    if (!sans.ok || !avec.ok) return;
    expect(avec.value).not.toBe(sans.value);
  });

  it('dessine comme une empreinte ordinaire une place qu’aucune zone ne déclare', () => {
    // Le plan ne devine pas un rattachement que la donnée ne porte pas : c'est
    // `DATA.PARKING_SPACE_WITHOUT_ZONE` qui le dit, pas le dessin.
    const r = renderFloorPlan(
      site({ zones: [], footprints: [
        ...refMultilevel.footprints.filter(f => f.kind !== 'parking_space'), p1,
      ] }),
      RDC, defaultOptions,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toContain('tok-park-fill');
    expect(r.value).toContain('tok-fp-fill');
  });

  it('ignore une zone de parking d’un autre niveau', () => {
    const ailleurs: SiteZone = { ...parkingZone(['fp-p1']), level_id: 'lvl-ml-r1' };
    const r = renderFloorPlan(
      site({ zones: [ailleurs], footprints: [
        ...refMultilevel.footprints.filter(f => f.kind !== 'parking_space'), p1,
      ] }),
      RDC, defaultOptions,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toContain('tok-park-fill');
  });

  it('écarte une place dégénérée plutôt que de dessiner un trait', () => {
    const plat: Footprint = {
      ...p1, geometry: { vertices: [{ x_m: 0, y_m: 0 }] },
    };
    const r = renderFloorPlan(
      site({ zones: [parkingZone(['fp-p1'])], footprints: [
        ...refMultilevel.footprints.filter(f => f.kind !== 'parking_space'), plat,
      ] }),
      RDC, defaultOptions,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toContain('tok-park-fill');
  });
});

describe('la surface non numérisée (S-37)', () => {
  const p1 = place('fp-p1', -20, -20);
  const surface = place('fp-surface', 0, -20);

  const avecLesDeux = () => site({
    zones: [parkingZone(['fp-p1', 'fp-surface'])],
    footprints: [
      ...refMultilevel.footprints.filter(f => f.kind !== 'parking_space'),
      p1, surface,
    ],
  });

  it('la dessine par-dessus les places et sous le bâti', () => {
    const r = renderFloorPlan(
      avecLesDeux(), RDC, defaultOptions, [marque('fp-surface')],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const park = r.value.indexOf('tok-park-fill');
    const unc = r.value.indexOf('tok-unc-fill');
    const fp = r.value.indexOf('tok-fp-fill');
    expect(park).toBeGreaterThan(-1);
    expect(park).toBeLessThan(unc);
    expect(unc).toBeLessThan(fp);
  });

  it('sans le fait qui la marque, elle est une place comme une autre', () => {
    // C'est l'existence du fait qui fait la marque, et rien d'autre.
    const r = renderFloorPlan(avecLesDeux(), RDC, defaultOptions, []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toContain('tok-unc-fill');
    expect(r.value).toContain('tok-park-fill');
  });

  it('ne lit pas la marque d’une autre empreinte', () => {
    const r = renderFloorPlan(
      avecLesDeux(), RDC, defaultOptions, [marque('fp-ailleurs')],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toContain('tok-unc-fill');
  });

  it('cadre le plan sur une surface qui déborde des places', () => {
    // Le cadrage ne tenait compte ni du bâti seul ni des places seules : une
    // surface tracée au-delà des deux se dessinait hors du viewBox, sans un mot.
    const loin = place('fp-surface', -400, -400, 100);
    const r = renderFloorPlan(
      site({
        zones: [parkingZone(['fp-p1', 'fp-surface'])],
        footprints: [
          ...refMultilevel.footprints.filter(f => f.kind !== 'parking_space'),
          p1, loin,
        ],
      }),
      RDC, defaultOptions, [marque('fp-surface')],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const points = pointsDuPolygone(r.value, 'tok-unc-fill');
    expect(points.length).toBe(4);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(defaultOptions.width_px);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(defaultOptions.height_px);
    }
  });
});

/** Les points d'un `<polygon>` dont le remplissage porte ce jeton. */
function pointsDuPolygone(svg: string, jeton: string): { x: number; y: number }[] {
  const balise = new RegExp(`<polygon[^>]*${jeton}[^>]*/>`).exec(svg)?.[0] ?? '';
  const bruts = /points="([^"]*)"/.exec(balise)?.[1] ?? '';
  if (bruts === '') return [];
  return bruts.split(' ').map((paire) => {
    const [x, y] = paire.split(',');
    return { x: Number(x), y: Number(y) };
  });
}
