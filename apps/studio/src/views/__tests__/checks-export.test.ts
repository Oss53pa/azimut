import { describe, it, expect } from 'vitest';
import type { Finding } from '@azimut/core-model';
import { toChecksCsv } from '../checks-export.js';

const BASE = {
  siteId: 'site-1',
  ranAt: '2026-09-17T10:00:00.000Z',
  findings: [] as readonly Finding[],
  roster: { run: [], skipped: [], undeclared: [] },
};

const FINDING: Finding = {
  code: 'LAYOUT.LEXICON_FORBIDDEN_TERM',
  severity: 'blocking',
  entity: { kind: 'destination_name', id: 'n-1' },
  params: { term: 'client' },
  ruleRef: 'A5.8',
};

function lines(csv: string): string[] {
  return csv.split('\n');
}

describe('toChecksCsv', () => {
  it('porte une en-tête, même sans aucune ligne', () => {
    expect(lines(toChecksCsv(BASE))).toEqual([
      'site;ran_at;record;code;state;entity_kind;entity_id;rule_ref',
    ]);
  });

  it('un rapport sans anomalie mais aux contrôles non exercés n’est pas un fichier vide', () => {
    // C'est la raison d'être du registre dans l'export : sans lui, ce cas et un
    // site parfaitement propre rendaient le même fichier.
    const csv = toChecksCsv({
      ...BASE,
      roster: { run: ['naming_collision'], skipped: [], undeclared: ['charter_lexicon'] },
    });
    expect(lines(csv)).toHaveLength(3);
    expect(csv).toContain('check;charter_lexicon;undeclared');
    expect(csv).toContain('check;naming_collision;run');
  });

  it('distingue un site propre d’un site non contrôlé', () => {
    const propre = toChecksCsv({ ...BASE, roster: { run: ['a', 'b'], skipped: [], undeclared: [] } });
    const nonControle = toChecksCsv({ ...BASE, roster: { run: [], skipped: [], undeclared: ['a', 'b'] } });
    expect(propre).not.toBe(nonControle);
  });

  it('écrit une anomalie avec son code, sa sévérité et son entité', () => {
    const csv = toChecksCsv({ ...BASE, findings: [FINDING] });
    expect(lines(csv)[1])
      .toBe('site-1;2026-09-17T10:00:00.000Z;finding;LAYOUT.LEXICON_FORBIDDEN_TERM;blocking;destination_name;n-1;A5.8');
  });

  it('protège une valeur qui contient le séparateur', () => {
    const piege: Finding = { ...FINDING, entity: { kind: 'zone', id: 'a;b' }, ruleRef: 'x"y' };
    const csv = toChecksCsv({ ...BASE, findings: [piege] });
    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"x""y"');
    // Le point-virgule protégé reste dans sa colonne, il n'en crée pas une.
    expect(lines(csv)[1]?.split('"a;b"')).toHaveLength(2);
  });

  it('est déterministe : même calcul, même fichier', () => {
    const input = {
      ...BASE,
      findings: [FINDING],
      roster: { run: ['b', 'a'], skipped: ['c'], undeclared: ['d'] },
    };
    expect(toChecksCsv(input)).toBe(toChecksCsv(input));
  });

  it('range les contrôles par état, dans un ordre fixe', () => {
    const csv = toChecksCsv({
      ...BASE,
      roster: { run: ['r1'], skipped: ['s1'], undeclared: ['u1'] },
    });
    const states = lines(csv).slice(1).map(l => l.split(';')[4]);
    expect(states).toEqual(['run', 'skipped', 'undeclared']);
  });
});
