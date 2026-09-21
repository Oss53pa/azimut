/**
 * Stationnement au plan de niveau — complément atelier, M2.
 *
 * Fichier distinct du reste des essais de `renderFloorPlan` : les deux réunis
 * dépassaient les quatre cents lignes qu'un fichier du dépôt ne franchit pas
 * sans découpage (A2.4). La coupure suit la matière, elle ne coupe pas au
 * milieu d'un sujet.
 */
import { describe, it, expect } from 'vitest';
import { renderFloorPlan } from '../render-floor-plan.js';
import type { FloorPlanOptions, FloorPlanTheme } from '../render-floor-plan.js';
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

describe('emprise de parking (complément atelier M2)', () => {
  const parking = (status: 'existant' | 'proposition') => ({
    id: 'park-1',
    org_id: 'org1',
    level_id: 'lvl-ml-rdc',
    geometry: {
      vertices: [
        { x_m: -20, y_m: -20 }, { x_m: 20, y_m: -20 },
        { x_m: 20, y_m: -5 }, { x_m: -20, y_m: -5 },
      ],
    },
    name: 'Ouest',
    free: true,
    declared_capacity: 0,
    provenance: { status, source: 'Plan' },
  });

  it('dessine l’emprise avant les empreintes : le parking est le sol', () => {
    const site = { ...refMultilevel, parkings: [parking('existant')] };
    const r = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const park = r.value.indexOf('tok-park-fill');
    const fp = r.value.indexOf('tok-fp-fill');
    expect(park).toBeGreaterThan(-1);
    expect(park).toBeLessThan(fp);
  });

  it('cadre le plan sur l’emprise, qui déborde du bâti', () => {
    // Sans le parking dans les bornes, il sortirait du cadre sans un mot.
    const sans = renderFloorPlan({ ...refMultilevel, parkings: [] }, 'lvl-ml-rdc', defaultOptions);
    const avec = renderFloorPlan({ ...refMultilevel, parkings: [parking('existant')] }, 'lvl-ml-rdc', defaultOptions);
    expect(sans.ok && avec.ok).toBe(true);
    if (!sans.ok || !avec.ok) return;
    expect(avec.value).not.toBe(sans.value);
  });

  it('trait plein pour un existant, pointillé pour une proposition', () => {
    // Un trait plein affirme ; un pointillé montre sans affirmer, ce que P1 (complément atelier)
    // demande d'une proposition.
    const existant = renderFloorPlan({ ...refMultilevel, parkings: [parking('existant')] }, 'lvl-ml-rdc', defaultOptions);
    const propose = renderFloorPlan({ ...refMultilevel, parkings: [parking('proposition')] }, 'lvl-ml-rdc', defaultOptions);
    expect(existant.ok && propose.ok).toBe(true);
    if (!existant.ok || !propose.ok) return;

    const ligneExistant = /<polygon[^>]*tok-park-stroke[^>]*\/>/.exec(existant.value)?.[0] ?? '';
    const lignePropose = /<polygon[^>]*tok-park-stroke[^>]*\/>/.exec(propose.value)?.[0] ?? '';
    expect(ligneExistant).not.toContain('stroke-dasharray');
    expect(lignePropose).toContain('stroke-dasharray');
  });

  it('écarte une emprise dégénérée plutôt que de dessiner un trait', () => {
    const plat = { ...parking('existant'), geometry: { vertices: [{ x_m: 0, y_m: 0 }] } };
    const r = renderFloorPlan({ ...refMultilevel, parkings: [plat] }, 'lvl-ml-rdc', defaultOptions);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toContain('tok-park-fill');
  });
});

describe('zone non couverte (complément atelier M2)', () => {
  const parkingExistant = {
    id: 'park-1',
    org_id: 'org-test-001',
    level_id: 'lvl-ml-rdc',
    geometry: {
      vertices: [
        { x_m: -20, y_m: -20 }, { x_m: 20, y_m: -20 },
        { x_m: 20, y_m: -5 }, { x_m: -20, y_m: -5 },
      ],
    },
    name: 'Ouest',
    free: true,
    declared_capacity: 0,
    provenance: { status: 'existant' as const, source: 'Plan' },
  };

  const zone = (withGeometry: boolean) => ({
    id: 'unc-1',
    org_id: 'org-test-001',
    parking_id: 'park-1',
    reason: 'Plan coupé au bord de page',
    ...(withGeometry
      ? {
          geometry: {
            vertices: [
              { x_m: 0, y_m: -20 }, { x_m: 20, y_m: -20 },
              { x_m: 20, y_m: -5 }, { x_m: 0, y_m: -5 },
            ],
          },
        }
      : {}),
  });

  it('dessine la zone tracée par-dessus l’emprise et sous le bâti', () => {
    const site = {
      ...refMultilevel,
      parkings: [parkingExistant],
      parking_uncovered: [zone(true)],
    };
    const r = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const park = r.value.indexOf('tok-park-fill');
    const unc = r.value.indexOf('tok-unc-fill');
    const fp = r.value.indexOf('tok-fp-fill');
    expect(park).toBeLessThan(unc);
    expect(unc).toBeLessThan(fp);
  });

  it('ne dessine rien pour une zone sans tracé, plutôt que d’inventer sa limite', () => {
    // Le plan reste alors muet sur une incomplétude que le contrôle connaît.
    // C'est une limite assumée : dessiner reviendrait à inventer la limite que
    // le relevé n'a pas trouvée.
    const site = {
      ...refMultilevel,
      parkings: [parkingExistant],
      parking_uncovered: [zone(false)],
    };
    const r = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toContain('tok-unc-fill');
  });

  it('ignore une zone rattachée à un parking d’un autre niveau', () => {
    const site = {
      ...refMultilevel,
      parkings: [parkingExistant],
      parking_uncovered: [{ ...zone(true), parking_id: 'park-ailleurs' }],
    };
    const r = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toContain('tok-unc-fill');
  });
});

describe('revue : ce que le plan dessine, il le cadre', () => {
  const emprise = {
    id: 'park-1',
    org_id: 'org-test-001',
    level_id: 'lvl-ml-rdc',
    geometry: {
      vertices: [
        { x_m: -20, y_m: -20 }, { x_m: 20, y_m: -20 },
        { x_m: 20, y_m: -5 }, { x_m: -20, y_m: -5 },
      ],
    },
    name: 'Ouest',
    free: true,
    declared_capacity: 0,
    provenance: { status: 'existant' as const, source: 'Plan' },
  };

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

  it('cadre le plan sur une zone non couverte qui déborde de l’emprise', () => {
    // Le cadrage ne tenait compte ni du bâti seul ni des emprises seules : une
    // zone tracée au-delà des deux se dessinait hors du viewBox, sans un mot.
    const site = {
      ...refMultilevel,
      parkings: [emprise],
      parking_uncovered: [{
        id: 'unc-1',
        org_id: 'org-test-001',
        parking_id: 'park-1',
        reason: 'Relevé interrompu au sud',
        geometry: {
          vertices: [
            { x_m: -400, y_m: -400 }, { x_m: -300, y_m: -400 },
            { x_m: -300, y_m: -300 }, { x_m: -400, y_m: -300 },
          ],
        },
      }],
    };
    const r = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
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

  it('ne dessine pas un parking retiré, et ne le cadre pas non plus', () => {
    // P1 (complément atelier) : le retiré reste en base pour l'historique et sort des livrables. Le
    // montrer en pointillé le confondrait avec une proposition — l'inverse même
    // d'un retrait, puisqu'une proposition n'existe pas encore.
    const retire = {
      ...emprise,
      geometry: {
        vertices: [
          { x_m: -500, y_m: -500 }, { x_m: -400, y_m: -500 },
          { x_m: -400, y_m: -400 }, { x_m: -500, y_m: -400 },
        ],
      },
      provenance: { status: 'retire' as const, source: 'Plan 2019' },
    };
    const sans = renderFloorPlan({ ...refMultilevel, parkings: [] }, 'lvl-ml-rdc', defaultOptions);
    const avec = renderFloorPlan({ ...refMultilevel, parkings: [retire] }, 'lvl-ml-rdc', defaultOptions);
    expect(sans.ok && avec.ok).toBe(true);
    if (!sans.ok || !avec.ok) return;

    expect(avec.value).not.toContain('tok-park-fill');
    // Même cadrage qu'en son absence : un objet qui ne se dessine pas ne doit
    // pas davantage tirer le plan vers lui.
    expect(avec.value).toBe(sans.value);
  });

  it('écarte la zone non couverte d’un parking retiré', () => {
    const retire = { ...emprise, provenance: { status: 'retire' as const, source: 'Plan 2019' } };
    const site = {
      ...refMultilevel,
      parkings: [retire],
      parking_uncovered: [{
        id: 'unc-1',
        org_id: 'org-test-001',
        parking_id: 'park-1',
        reason: 'Relevé interrompu',
        geometry: {
          vertices: [
            { x_m: 0, y_m: -20 }, { x_m: 20, y_m: -20 }, { x_m: 20, y_m: -5 },
          ],
        },
      }],
    };
    const r = renderFloorPlan(site, 'lvl-ml-rdc', defaultOptions);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toContain('tok-unc-fill');
  });

  it('dessine encore une proposition, que le retrait ne doit pas emporter', () => {
    const propose = { ...emprise, provenance: { status: 'proposition' as const, source: 'Détection' } };
    const r = renderFloorPlan({ ...refMultilevel, parkings: [propose] }, 'lvl-ml-rdc', defaultOptions);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('tok-park-fill');
  });
});
