import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import type { Level, SiteData } from '@azimut/core-model';
import { buildKioskMapFiles, buildKioskTree } from '../build-kiosk-tree.js';
import { createBuildKioskPackageHandler, kioskContextFromAssets } from '../build-kiosk-package.js';
import type { Job } from '../job.js';

/**
 * D10.0 — « L'assemblage d'un paquet agrège les anomalies de chaque rendu
 * qu'il embarque, et ne lit jamais le seul succès. Une marque de sécurité
 * omise, faute de fonction désignée, bloque la construction du paquet. »
 */

const enc = new TextEncoder();
const appAssets = {
  indexHtml: enc.encode('<!doctype html><title>Borne</title>'),
  appJs: enc.encode('export const boot = () => {};'),
  appCss: enc.encode('body{margin:0}'),
};

/** Un niveau vide de plus : son plan se rend, avec un avertissement. */
const EMPTY_LEVEL: Level = {
  id: 'lvl-ml-vide',
  org_id: refMultilevel.organization.id,
  building_id: refMultilevel.levels[0]?.building_id ?? '',
  name: 'R+9',
  ordinal: 9,
  elevation_m: 40,
};
const withEmptyLevel: SiteData = { ...refMultilevel, levels: [...refMultilevel.levels, EMPTY_LEVEL] };
const unbound: SiteData = { ...refMultilevel, rules_bindings: [] };

function job(): Job {
  return {
    id: 'job-d10-0', org_id: 'org-test-001', kind: 'build_kiosk_package', state: 'running',
    payload: { built_at: '2026-09-01T00:00:00Z' }, result: null, attempts: 1, max_attempts: 3,
    created_at: new Date('2026-09-01T00:00:00Z'), started_at: new Date('2026-09-01T00:00:01Z'),
    finished_at: null, error: null,
  };
}

describe('D10.0 — une marque de sécurité omise bloque le paquet', () => {
  it('refuse les plans d’un site dont la marque d’accessibilité n’est pas désignée', () => {
    const built = buildKioskMapFiles(unbound);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    const omitted = built.findings.filter(f => f.code === 'PICTO.FUNCTION_NOT_DESIGNATED');
    expect(omitted.length).toBeGreaterThan(0);
    expect(omitted[0]?.params).toMatchObject({ registry: 'safety', level_id: 'lvl-ml-rdc' });
  });

  it('refuse l’arbre du paquet, et le travail de construction échoue en nommant le code', async () => {
    expect(buildKioskTree(unbound, appAssets).ok).toBe(false);
    const handler = createBuildKioskPackageHandler(kioskContextFromAssets(
      unbound, appAssets, { version: 1, langs: ['fr', 'en'], minRuntime: '1.0.0' },
    ));
    await expect(handler(job())).rejects.toThrow('PICTO.FUNCTION_NOT_DESIGNATED');
  });

  it('construit le paquet d’un site dont la marque est désignée', () => {
    const built = buildKioskMapFiles(refMultilevel);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.warnings.map(f => f.code)).not.toContain('PICTO.FUNCTION_NOT_DESIGNATED');
    }
  });
});

describe('D10.0 — les avertissements des rendus ne se perdent pas', () => {
  it('rassemble l’avertissement de chaque niveau, avec le niveau qui le porte', () => {
    const built = buildKioskMapFiles(withEmptyLevel);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const empty = built.warnings.find(f => f.code === 'LAYOUT.FLOOR_PLAN_EMPTY_LEVEL');
    expect(empty?.params['level_id']).toBe('lvl-ml-vide');
    expect(built.value.has('maps/level-9.svg')).toBe(true);
  });

  it('les porte jusqu’au résultat du travail de construction', async () => {
    const handler = createBuildKioskPackageHandler(kioskContextFromAssets(
      withEmptyLevel, appAssets, { version: 1, langs: ['fr', 'en'], minRuntime: '1.0.0' },
    ));
    const result = await handler(job());
    const findings = result['findings'] as readonly { readonly code: string }[];
    expect(findings.map(f => f.code)).toContain('LAYOUT.FLOOR_PLAN_EMPTY_LEVEL');
  });
});
