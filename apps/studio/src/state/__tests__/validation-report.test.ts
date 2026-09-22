import { describe, it, expect } from 'vitest';
import {
  NEVER_RUN, SEVERITY_ORDER, groupByEntity, countsBySeverity, present,
  coverageDisplay, prepareExport, hasNormativeReference, toLine,
} from '../validation-report.js';
import type { ValidationState } from '../validation-report.js';
import type { Finding } from '@azimut/core-model';

function finding(
  code: string,
  severity: Finding['severity'],
  entity: Finding['entity'] = null,
  ruleRef: string | null = null,
): Finding {
  return { code, severity, entity, params: {}, ruleRef };
}

function ran(findings: readonly Finding[]): ValidationState {
  return { kind: 'ran', findings, ranAt: '2026-09-22T10:00:00.000Z', durationMs: 412 };
}

/**
 * M5 (partie M) — « Un écran vide qui ressemble à une réussite alors que rien
 * n'a été calculé est le pire des états possibles. » C'est M7.11 (partie M).
 */
describe('M5 (partie M) — jamais lancé n’est pas un succès', () => {
  it('une validation jamais lancée invite à la lancer', () => {
    expect(present(NEVER_RUN)).toEqual({ kind: 'invite' });
  });

  it('une validation sans anomalie est un constat net, pas une invitation', () => {
    expect(present(ran([]))).toEqual({ kind: 'clean' });
  });

  /**
   * Les deux états rendent une liste vide. Les confondre ferait passer un site
   * non contrôlé pour un site sain, et c'est exactement ce que M5 (partie M) nomme comme
   * le pire des cas.
   */
  it('les deux états vides ne se confondent jamais', () => {
    expect(present(NEVER_RUN).kind).not.toBe(present(ran([])).kind);
  });

  it('une validation en cours annonce sa progression', () => {
    expect(present({ kind: 'running', startedAt: '2026-09-22T10:00:00.000Z' }))
      .toEqual({ kind: 'progress' });
  });
});

/**
 * M5 (partie M) : « Anomalies groupées par entité, ordonnées par gravité
 * décroissante. »
 */
describe('M5 (partie M) — groupement et ordre', () => {
  const node12 = { kind: 'node', id: 'N-12' };
  const node3 = { kind: 'node', id: 'N-3' };

  it('groupe les anomalies d’une même entité', () => {
    const groups = groupByEntity([
      finding('GRAPH.NODE_ORPHAN', 'blocking', node12),
      finding('GRAPH.DEAD_END_UNJUSTIFIED', 'warning', node12),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0]?.findings.length).toBe(2);
  });

  it('range les groupes par gravité décroissante', () => {
    const groups = groupByEntity([
      finding('GRAPH.DEAD_END_UNJUSTIFIED', 'warning', node3),
      finding('GRAPH.NODE_ORPHAN', 'blocking', node12),
    ]);
    expect(groups.map(g => g.severity)).toEqual(['blocking', 'warning']);
  });

  it('un groupe prend la gravité la plus forte qu’il porte', () => {
    const groups = groupByEntity([
      finding('A.B', 'info', node12),
      finding('C.D', 'blocking', node12),
    ]);
    expect(groups[0]?.severity).toBe('blocking');
  });

  /**
   * Sans départage, deux exécutions du même état rendraient deux listes dans
   * deux ordres, et l'export cesserait d'être reproductible (INV-4).
   */
  it('l’ordre est total : deux exécutions rendent la même liste', () => {
    const findings = [
      finding('Z.Z', 'blocking', node3),
      finding('A.A', 'blocking', node12),
      finding('M.M', 'blocking', null),
    ];
    const a = groupByEntity(findings);
    const b = groupByEntity([...findings].reverse());
    expect(a).toEqual(b);
  });

  it('les anomalies sans entité ont leur propre groupe', () => {
    const groups = groupByEntity([
      finding('A.A', 'blocking', null),
      finding('B.B', 'blocking', node12),
    ]);
    expect(groups.length).toBe(2);
    expect(groups.some(g => g.entity === null)).toBe(true);
  });

  it('compte par gravité, dans l’ordre du bandeau', () => {
    expect([...SEVERITY_ORDER]).toEqual(['blocking', 'warning', 'info']);
    expect(countsBySeverity([
      finding('A.A', 'blocking'), finding('B.B', 'blocking'),
      finding('C.C', 'warning'), finding('D.D', 'info'),
    ])).toEqual({ blocking: 2, warning: 1, info: 1 });
  });
});

/**
 * M02.W10 (partie N) : « Aucun taux de couverture n'est publié tant que la
 * validation de complétude échoue. » M5 (partie M) : « Le compteur
 * correspondant indique que le calcul est conditionné, il n'affiche jamais
 * zéro ni un tiret. »
 */
describe('M5 (partie M) — le taux de couverture est conditionné', () => {
  it('n’affiche rien tant que la validation n’a pas tourné', () => {
    expect(coverageDisplay(NEVER_RUN, 87)).toEqual({ kind: 'conditioned', on: 'never_run' });
  });

  it('n’affiche rien tant qu’une bloquante subsiste', () => {
    expect(coverageDisplay(ran([finding('A.A', 'blocking')]), 87))
      .toEqual({ kind: 'conditioned', on: 'blocking_findings' });
  });

  it('affiche le taux quand la validation aboutit', () => {
    expect(coverageDisplay(ran([finding('A.A', 'warning')]), 87))
      .toEqual({ kind: 'value', ratePct: 87 });
  });

  /**
   * Un zéro se lit comme un résultat, un tiret comme une absence de donnée.
   * Ni l'un ni l'autre ne dit « ce calcul attend qu'un autre aboutisse ».
   */
  it('ne rend jamais zéro à la place d’un calcul conditionné', () => {
    const display = coverageDisplay(NEVER_RUN, null);
    expect(display.kind).toBe('conditioned');
    expect('ratePct' in display).toBe(false);
  });
});

/**
 * M5 (partie M) : « Exporter | Document ou tableur, avec l'horodatage et la
 * version du paquet de règles. »
 */
describe('M5 (partie M) — export', () => {
  const pack = { key: 'fr-erp', version: '2026.1' };

  it('porte l’horodatage, la durée et la version des règles', () => {
    const exported = prepareExport(ran([finding('A.A', 'blocking')]), pack);
    expect(exported?.ranAt).toBe('2026-09-22T10:00:00.000Z');
    expect(exported?.durationMs).toBe(412);
    expect(exported?.rulesPack).toEqual(pack);
  });

  /**
   * Un rapport d'anomalies sans la version des règles qui l'ont produit ne se
   * compare à rien et ne s'oppose à personne. L'absence de paquet se dit,
   * elle ne se tait pas.
   */
  it('dit l’absence de paquet plutôt que de la taire', () => {
    expect(prepareExport(ran([]), null)?.rulesPack).toBeNull();
  });

  /** Exporter une validation jamais lancée produirait un document qui ment. */
  it('refuse d’exporter ce qui n’a pas été calculé', () => {
    expect(prepareExport(NEVER_RUN, pack)).toBeNull();
    expect(prepareExport({ kind: 'running', startedAt: 'x' }, pack)).toBeNull();
  });

  it('deux exports du même état sont identiques (INV-4)', () => {
    const state = ran([
      finding('B.B', 'warning', { kind: 'edge', id: 'E-2' }),
      finding('A.A', 'blocking', { kind: 'node', id: 'N-1' }),
    ]);
    expect(prepareExport(state, pack)).toEqual(prepareExport(state, pack));
  });
});

/**
 * M5 (partie M) : « Une anomalie d'origine normative affiche sa référence
 * documentaire. Une anomalie normative sans référence visible est un défaut,
 * pas un détail de présentation. »
 */
describe('M5 (partie M) — référence normative et ligne d’anomalie', () => {
  it('montre la référence quand l’anomalie en porte une', () => {
    const line = toLine(finding('LAYOUT.CHAR_HEIGHT_BELOW_MIN', 'blocking', null, 'fr-erp/char-height'));
    expect(line.ruleRef).toBe('fr-erp/char-height');
  });

  it('ne fabrique pas de référence quand il n’y en a pas', () => {
    expect(toLine(finding('GRAPH.NODE_ORPHAN', 'blocking')).ruleRef).toBeNull();
  });

  it('reconnaît l’origine normative à la référence, non au domaine', () => {
    // `LAYOUT.ISO_LEVEL_NOT_FOUND` signale un niveau introuvable : un défaut
    // de donnée, sans origine réglementaire. Classer par domaine le rangerait
    // à tort parmi les normatives.
    expect(hasNormativeReference(finding('LAYOUT.ISO_LEVEL_NOT_FOUND', 'blocking'))).toBe(false);
    expect(hasNormativeReference(finding('LAYOUT.CHAR_HEIGHT_BELOW_MIN', 'blocking', null, 'r-12'))).toBe(true);
  });

  /**
   * M5 (partie M) : « un lien qui ouvre la zone de travail centrée sur elle avec la
   * sélection déjà faite ». Sans entité, il n'y a rien à centrer.
   */
  it('n’offre le lien que lorsqu’il y a une entité à ouvrir', () => {
    expect(toLine(finding('A.A', 'blocking', { kind: 'node', id: 'N-1' })).openable).toBe(true);
    expect(toLine(finding('A.A', 'blocking', null)).openable).toBe(false);
  });

  it('reporte l’entité et la gravité telles quelles', () => {
    const line = toLine(finding('A.A', 'warning', { kind: 'edge', id: 'E-9' }));
    expect(line.entity).toEqual({ kind: 'edge', id: 'E-9' });
    expect(line.severity).toBe('warning');
  });
});
