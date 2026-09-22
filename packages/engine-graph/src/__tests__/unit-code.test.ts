import { describe, it, expect } from 'vitest';
import { runChecks } from '../run-checks.js';
import { refBroken, refMinimal, refMultilevel } from '@azimut/testkit';
import type { Finding, SiteData } from '@azimut/core-model';

function findingsOf(site: SiteData): readonly Finding[] {
  const result = runChecks(site);
  return result.ok ? result.value.findings : result.findings;
}

function codes(site: SiteData, code: string): readonly Finding[] {
  return findingsOf(site).filter(f => f.code === code);
}

/**
 * N1.4 — règle M01.S3 et unicité du code d'unité.
 *
 * Le critère N1.7-3 demande que chaque cas soit détecté sur un site de
 * référence dédié, et ne le soit pas sur le site voisin. `ref-broken` porte
 * les violations, les trois autres sites sont propres.
 */
describe('M01.S3 — une cellule porte obligatoirement un code d’unité', () => {
  it('signale la cellule sans code, et elle seule', () => {
    const found = codes(refBroken, 'DATA.UNIT_CODE_REQUIRED');
    expect(found).toHaveLength(1);
    expect(found[0]?.entity).toEqual({ kind: 'footprint', id: 'fp-brk-nocode' });
    expect(found[0]?.severity).toBe('blocking');
    expect(found[0]?.ruleRef).toBe('N1.4');
    expect(found[0]?.params['level_id']).toBe('lvl-brk-rdc');
  });

  it('ne signale rien sur les sites dont les cellules sont codées', () => {
    expect(codes(refMinimal, 'DATA.UNIT_CODE_REQUIRED')).toHaveLength(0);
    expect(codes(refMultilevel, 'DATA.UNIT_CODE_REQUIRED')).toHaveLength(0);
  });

  it('n’exige aucun code des natures autres que la cellule', () => {
    // Empreinte de circulation construite sans code : une propriété
    // facultative absente, pas une propriété présente et vide.
    const circulation: SiteData = {
      ...refMinimal,
      footprints: refMinimal.footprints.map(f => ({
        id: f.id,
        org_id: f.org_id,
        level_id: f.level_id,
        geometry: f.geometry,
        kind: 'circulation',
      })),
    };
    expect(codes(circulation, 'DATA.UNIT_CODE_REQUIRED')).toHaveLength(0);
  });

  it('traite un code fait d’espaces comme un code absent', () => {
    const blank: SiteData = {
      ...refMinimal,
      footprints: refMinimal.footprints.map(f => ({ ...f, unit_code: '   ' })),
    };
    expect(codes(blank, 'DATA.UNIT_CODE_REQUIRED')).toHaveLength(1);
  });
});

describe('N1.4 — unicité du code d’unité par niveau', () => {
  it('signale les deux cellules qui partagent un code sur un niveau', () => {
    const found = codes(refBroken, 'DATA.CODE_DUPLICATE');
    expect(found.map(f => f.entity?.id)).toEqual(['fp-brk-dup-a', 'fp-brk-dup-b']);
    for (const finding of found) {
      expect(finding.severity).toBe('blocking');
      expect(finding.ruleRef).toBe('N1.4');
      expect(finding.params['unit_code']).toBe('c-200');
      expect(finding.params['level_id']).toBe('lvl-brk-rdc');
      expect(finding.params['count']).toBe(2);
    }
  });

  it('la casse ne sauve pas un doublon : C-200 et c-200 se confondent', () => {
    // fp-brk-dup-b porte « c-200 », fp-brk-dup-a porte « C-200 ».
    expect(codes(refBroken, 'DATA.CODE_DUPLICATE')).toHaveLength(2);
  });

  it('ne signale pas le même code porté sur un autre niveau', () => {
    // fp-brk-other-level porte C-200 sur lvl-brk-r1 : la portée est le niveau.
    const ids = codes(refBroken, 'DATA.CODE_DUPLICATE').map(f => f.entity?.id);
    expect(ids).not.toContain('fp-brk-other-level');
  });

  it('ne signale aucun doublon sur les sites voisins', () => {
    expect(codes(refMinimal, 'DATA.CODE_DUPLICATE')).toHaveLength(0);
    expect(codes(refMultilevel, 'DATA.CODE_DUPLICATE')).toHaveLength(0);
  });

  it('ne compte pas deux fois une cellule déjà signalée sans code', () => {
    // Trois cellules sans code sur un niveau ne sont pas trois doublons : le
    // code absent relève de M01.S3, pas de l'unicité.
    const noCodes: SiteData = {
      ...refMinimal,
      footprints: [0, 1, 2].map(i => ({
        id: `fp-${String(i)}`,
        org_id: 'org-test-001',
        level_id: 'lvl-001',
        kind: 'cell',
        geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }, { x_m: 1, y_m: 1 }] },
      })),
    };
    expect(codes(noCodes, 'DATA.UNIT_CODE_REQUIRED')).toHaveLength(3);
    expect(codes(noCodes, 'DATA.CODE_DUPLICATE')).toHaveLength(0);
  });
});

describe('N1.4 — les deux contrôles sont déclarés exécutés', () => {
  it('figurent dans la liste des contrôles exécutés', () => {
    const result = runChecks(refMinimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checks_run).toContain('unit_code_required');
    expect(result.value.checks_run).toContain('unit_code_duplicate');
  });
});
