import { describe, it, expect } from 'vitest';
import { ERROR_CATALOG, ANOMALY_DOMAINS } from '../error-catalog.js';

describe('ERROR_CATALOG', () => {
  const entries = Object.entries(ERROR_CATALOG);
  const codes = Object.keys(ERROR_CATALOG);

  it('is not empty', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('every entry has a valid severity', () => {
    const validSeverities = new Set(['blocking', 'warning', 'info']);
    for (const [code, entry] of entries) {
      expect(validSeverities.has(entry.severity)).toBe(true);
      // attach code for readable failure message
      if (!validSeverities.has(entry.severity)) {
        throw new Error(`${code} has invalid severity: ${entry.severity}`);
      }
    }
  });

  it('every entry has a non-empty description', () => {
    for (const [code, entry] of entries) {
      expect(entry.description.length).toBeGreaterThan(0);
      if (entry.description.length === 0) {
        throw new Error(`${code} has empty description`);
      }
    }
  });

  it('all codes follow DOMAIN.SPECIFIC_CODE format', () => {
    const pattern = /^[A-Z]+\.[A-Z][A-Z0-9_]*$/;
    for (const code of codes) {
      expect(pattern.test(code)).toBe(true);
    }
  });

  it('codes are grouped by domain prefix', () => {
    const domains = new Set(codes.map((c) => c.split('.')[0]));
    expect(domains.size).toBeGreaterThan(1);
    // Known domains
    const expected = ['GRAPH', 'GEOM', 'LAYOUT', 'RULES', 'SECURITY', 'IMPORT', 'PACKAGE', 'DATA'];
    for (const d of expected) {
      expect(domains.has(d)).toBe(true);
    }
  });

  it('every code domain is in the D2.1 allowlist, and them alone (strict)', () => {
    const allowed = new Set<string>(ANOMALY_DOMAINS);
    for (const code of codes) {
      const domain = code.split('.')[0] as string;
      expect(allowed.has(domain)).toBe(true);
      if (!allowed.has(domain)) {
        throw new Error(`${code} uses unauthorized anomaly domain "${domain}"`);
      }
    }
  });

  it('la liste des domaines est épinglée, et sans domaine vide', () => {
    // Liste épinglée volontairement : un domaine nouveau casse ce test, ce qui
    // force à le déclarer plutôt qu'à le laisser apparaître. Qu'elle tienne
    // dans celle de D2.1 se vérifie contre le consolidé lui-même, dans
    // `tests/catalogue-consolide.test.ts`.
    //
    // `CHARTER` en est sorti : déclaré pendant plusieurs versions sans porter
    // un seul code, il annonçait un cloisonnement que rien n'appliquait.
    // `NET` en était sorti avant lui, pour un autre motif — voir
    // `RETIRED_CODES`.
    expect([...ANOMALY_DOMAINS].sort()).toEqual(
      [
        'AD', 'ASSET', 'ASSIST', 'CALIB', 'COLOR', 'COST', 'DATA',
        'DOC', 'EDIT',
        'FLOW', 'FONT', 'GEOM', 'GRAPH', 'IMPORT', 'INK', 'INSTALL', 'LAYOUT',
        'LIBRARY', 'MODULE', 'PACKAGE', 'PARK', 'PICTO', 'RENDER',
        'REVIEW', 'RULES',
        'SECURITY', 'SKETCH', 'SURVEY', 'TENANT', 'TYPO', 'WAYFIND',
      ],
    );
  });

  /**
   * La leçon de `CHARTER` : un domaine déclaré et vide annonce un
   * cloisonnement que rien n'applique. Il n'a pas lieu d'être, et ce contrôle
   * est ce qui manquait pour le voir.
   */
  it('aucun domaine déclaré ne reste sans code', () => {
    const porteurs = new Set(codes.map(code => code.split('.')[0]));
    const vides = [...ANOMALY_DOMAINS].filter(domain => !porteurs.has(domain));
    expect(vides, `Domaines déclarés et vides :\n${vides.join('\n')}`).toEqual([]);
  });

  it('no duplicate codes (type-level guarantee, runtime check)', () => {
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('blocking severity dominates', () => {
    const blocking = entries.filter(([, e]) => e.severity === 'blocking');
    const warning = entries.filter(([, e]) => e.severity === 'warning');
    const info = entries.filter(([, e]) => e.severity === 'info');
    expect(blocking.length).toBeGreaterThan(warning.length);
    expect(blocking.length).toBeGreaterThan(info.length);
  });

  it('contains at least one info-severity entry', () => {
    const infoEntries = entries.filter(([, e]) => e.severity === 'info');
    expect(infoEntries.length).toBeGreaterThan(0);
  });

  it('every domain prefix has at least one entry', () => {
    const expected = ['GRAPH', 'GEOM', 'LAYOUT', 'RULES', 'SECURITY', 'IMPORT', 'PACKAGE', 'DATA'];
    for (const prefix of expected) {
      const matching = codes.filter((c) => c.startsWith(`${prefix}.`));
      expect(matching.length).toBeGreaterThan(0);
    }
  });

  it('no description contains a hardcoded hex color', () => {
    for (const [, entry] of entries) {
      expect(entry.description).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
