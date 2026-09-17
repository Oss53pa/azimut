import { describe, it, expect } from 'vitest';
import { siteOrigin, guardSiteOrigin, firstCalibration } from '../plan.js';
import type { PlanCalibration, SiteOriginBearer } from '../plan.js';

const POSED: SiteOriginBearer = { origin_x: -12.5, origin_y: -8 };
const UNPOSED: SiteOriginBearer = {};

/**
 * S1 — « Le repère site est fixé au premier calage et n'est jamais modifié. »
 *
 * Les deux nombres sont ceux du premier calage, recopiés sur la ligne `site`.
 */
describe('siteOrigin', () => {
  it('rend le point quand les deux coordonnées sont là', () => {
    expect(siteOrigin(POSED)).toEqual({ x_m: -12.5, y_m: -8 });
  });

  it('rend null quand le repère n’est pas posé', () => {
    expect(siteOrigin(UNPOSED)).toBeNull();
  });

  it('lit une origine à moitié saisie comme absente', () => {
    // Surtout pas comme un point dont l'autre coordonnée vaudrait zéro.
    expect(siteOrigin({ origin_x: -12.5 })).toBeNull();
    expect(siteOrigin({ origin_y: -8 })).toBeNull();
  });

  it('rend null sur une valeur stockée illisible', () => {
    expect(siteOrigin({ origin_x: Number.NaN, origin_y: 0 })).toBeNull();
  });

  it('distingue le repère posé à (0, 0) du repère non posé', () => {
    expect(siteOrigin({ origin_x: 0, origin_y: 0 })).toEqual({ x_m: 0, y_m: 0 });
    expect(siteOrigin({})).toBeNull();
  });
});

describe('guardSiteOrigin — S1', () => {
  it('laisse le premier calage poser le repère', () => {
    const result = guardSiteOrigin(UNPOSED, { x_m: -12.5, y_m: -8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ x_m: -12.5, y_m: -8 });
  });

  it('laisse repasser la même origine sans rien refuser', () => {
    // Un second calage du même fond, ou le calage d'un autre niveau sur le
    // même repère, doit aboutir.
    expect(guardSiteOrigin(POSED, { x_m: -12.5, y_m: -8 }).ok).toBe(true);
  });

  it('refuse une origine différente une fois le repère posé', () => {
    const result = guardSiteOrigin(POSED, { x_m: 0, y_m: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.code).toBe('CALIB.ORIGIN_LOCKED');
    expect(result.findings[0]?.severity).toBe('blocking');
    expect(result.findings[0]?.ruleRef).toBe('N1.3');
    expect(result.findings[0]?.params).toEqual({
      current_x: -12.5,
      current_y: -8,
      requested_x: 0,
      requested_y: 0,
    });
  });

  it('refuse un écart même infime : l’origine est recopiée, pas remesurée', () => {
    const result = guardSiteOrigin(POSED, { x_m: -12.5, y_m: -8.000001 });
    expect(result.ok).toBe(false);
  });

  it('refuse le déplacement d’une seule des deux coordonnées', () => {
    expect(guardSiteOrigin(POSED, { x_m: -12.4, y_m: -8 }).ok).toBe(false);
    expect(guardSiteOrigin(POSED, { x_m: -12.5, y_m: -7.9 }).ok).toBe(false);
  });

  it('pose le repère sur un site dont une seule coordonnée traînait', () => {
    // La lecture tient la paire pour absente : c'est donc un premier calage.
    expect(guardSiteOrigin({ origin_x: 3 }, { x_m: 0, y_m: 0 }).ok).toBe(true);
  });
});

const CAL = {
  org_id: 'org-1',
  plan_source_id: 'ps-1',
  scale_m_per_px: 0.05,
  origin_x: 0,
  origin_y: 0,
  rotation_deg: 0,
} as const;

function cal(id: string, at?: string): PlanCalibration {
  return { ...CAL, id, ...(at !== undefined ? { calibrated_at: at } : {}) };
}

/**
 * S1 — `calibrated_at` rend « le premier calage » identifiable. Sans lui, la
 * règle était opposable et invérifiable.
 */
describe('firstCalibration', () => {
  it('désigne le calage le plus ancien', () => {
    const first = firstCalibration([
      cal('c-late', '2026-03-02T09:00:00.000Z'),
      cal('c-early', '2026-03-01T09:00:00.000Z'),
      cal('c-mid', '2026-03-01T18:00:00.000Z'),
    ]);
    expect(first?.id).toBe('c-early');
  });

  it('ne dépend pas de l’ordre d’entrée (invariant 4)', () => {
    const list = [
      cal('c-a', '2026-03-01T09:00:00.000Z'),
      cal('c-b', '2026-03-02T09:00:00.000Z'),
    ];
    expect(firstCalibration(list)?.id).toBe(firstCalibration([...list].reverse())?.id);
  });

  it('tranche une égalité de dates par l’identifiant', () => {
    const same = '2026-03-01T09:00:00.000Z';
    expect(firstCalibration([cal('c-b', same), cal('c-a', same)])?.id).toBe('c-a');
  });

  it('rend null quand il n’y a aucun calage', () => {
    expect(firstCalibration([])).toBeNull();
  });

  it('rend null quand un seul calage n’a pas de date', () => {
    // Le non daté pourrait être le plus ancien : rien ne permet de l'écarter,
    // donc la réponse est inconnue et non « le plus ancien des datés ».
    const first = firstCalibration([
      cal('c-dated', '2026-03-01T09:00:00.000Z'),
      cal('c-undated'),
    ]);
    expect(first).toBeNull();
  });

  it('rend null sur une date illisible', () => {
    expect(firstCalibration([cal('c-bad', 'hier matin')])).toBeNull();
  });

  it('accepte un calage unique et daté', () => {
    expect(firstCalibration([cal('c-only', '2026-03-01T09:00:00.000Z')])?.id).toBe('c-only');
  });
});
