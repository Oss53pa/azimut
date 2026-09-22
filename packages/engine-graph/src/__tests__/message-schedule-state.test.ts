import { describe, it, expect } from 'vitest';
import type { Finding } from '@azimut/core-model';
import { SCHEDULE_STATES } from '../message-schedule.js';
import type {
  MessageLine,
  MessageSchedule,
  ScheduleState,
} from '../message-schedule.js';
import {
  SCHEDULE_TRANSITIONS,
  SCHEDULE_TRIGGERS,
  transitionSchedule,
  triggersFrom,
} from '../message-schedule-state.js';
import type { ScheduleTransitionContext } from '../message-schedule-state.js';

/**
 * R12 (partie R) — le circuit de validation du tableau des messages.
 *
 * L'essai ne relit pas la table de transitions : il l'exerce. Chacune des six
 * lignes de R12 est jouée, chaque condition de sa colonne « Condition » est
 * mise en défaut, et tous les couples que la table ne porte pas sont refusés.
 * C'est ce dernier point qui compte le plus : une machine à états ne se juge
 * pas à ce qu'elle permet, mais à ce qu'elle interdit.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function line(id: string, stale = false): MessageLine {
  return {
    id,
    support_id: 'sup-1',
    face_index: 0,
    block_index: 0,
    block_kind: 'destination_list',
    entries: [],
    pictogram_id: null,
    direction: null,
    information_level: 2,
    decision_point_id: 'n-hall',
    stale,
  };
}

function schedule(
  state: ScheduleState,
  lines: readonly MessageLine[] = [line('l-1')],
  version = 7,
): MessageSchedule {
  return {
    site_id: 'site-1',
    version,
    state,
    generated_at: '2026-04-01T00:00:00.000Z',
    inputs_hash: 'abcd1234',
    lines,
  };
}

/** Contexte où toutes les conditions de R12 sont satisfaites. */
function context(
  over: Partial<ScheduleTransitionContext> = {},
): ScheduleTransitionContext {
  return {
    schedule: schedule('draft'),
    findings: [],
    graphValidated: true,
    openAnnotationIds: [],
    rejectionReason: null,
    supersedingVersion: null,
    ...over,
  };
}

function blocking(code: string): Finding {
  return { code, severity: 'blocking', entity: null, params: {}, ruleRef: null };
}

function codes(result: ReturnType<typeof transitionSchedule>): readonly string[] {
  return result.ok ? [] : result.findings.map(f => f.code);
}

// ---------------------------------------------------------------------------
// Les six lignes de la table
// ---------------------------------------------------------------------------

describe('R12 — les six transitions de la table, et elles seules', () => {
  it('aucune version puis Générer donne un brouillon', () => {
    const r = transitionSchedule('generate', context({ schedule: null }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ from: null, to: 'draft', trigger: 'generate' });
  });

  it('un brouillon régénéré reste un brouillon', () => {
    const r = transitionSchedule('regenerate', context());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.to).toBe('draft');
  });

  it('un brouillon sans anomalie et sur graphe validé passe en revue', () => {
    const r = transitionSchedule('submit_for_review', context());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.to).toBe('in_review');
  });

  it('un rejet motivé ramène au brouillon', () => {
    const r = transitionSchedule('reject', context({
      schedule: schedule('in_review'),
      rejectionReason: 'Les noms de la restauration ne sont pas les bons',
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.to).toBe('draft');
  });

  it('une version en revue sans annotation ouverte ni ligne périmée s’approuve', () => {
    const r = transitionSchedule('approve', context({ schedule: schedule('in_review') }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.to).toBe('approved');
  });

  it('une version approuvée est remplacée par une version ultérieure', () => {
    const r = transitionSchedule('supersede', context({
      schedule: schedule('approved'),
      supersedingVersion: 8,
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.to).toBe('superseded');
  });

  it('la table porte exactement six lignes', () => {
    expect(SCHEDULE_TRANSITIONS).toHaveLength(6);
  });

  /**
   * Le cœur de l'essai : tout ce que la table ne porte pas est refusé. Trente
   * couples possibles, six permis, vingt-quatre refusés — et le compte est
   * vérifié pour qu'un déclencheur ajouté sans ligne ne passe pas inaperçu.
   */
  it('tout couple absent de la table est refusé, sans exception', () => {
    const states: readonly (ScheduleState | null)[] = [null, ...SCHEDULE_STATES];
    const permitted: string[] = [];
    const refused: string[] = [];

    for (const state of states) {
      for (const trigger of SCHEDULE_TRIGGERS) {
        const ctx = context({
          schedule: state === null ? null : schedule(state),
          rejectionReason: 'motif',
          supersedingVersion: 99,
        });
        const r = transitionSchedule(trigger, ctx);
        const key = `${state ?? 'aucune'} + ${trigger}`;
        if (r.ok) permitted.push(key);
        else {
          refused.push(key);
          const inTable = SCHEDULE_TRANSITIONS.some(
            t => t.from === state && t.trigger === trigger,
          );
          if (!inTable) expect(codes(r)).toEqual(['EDIT.CONTEXT_VIOLATION']);
        }
      }
    }

    expect(permitted).toHaveLength(6);
    expect(refused).toHaveLength(24);
  });

  it('un tableau approuvé n’admet que son remplacement', () => {
    expect(triggersFrom('approved')).toEqual(['supersede']);
  });

  it('un tableau remplacé n’admet plus rien', () => {
    expect(triggersFrom('superseded')).toEqual([]);
  });

  it('triggersFrom rend exactement les déclencheurs de la table', () => {
    expect(triggersFrom(null)).toEqual(['generate']);
    expect(triggersFrom('draft')).toEqual(['regenerate', 'submit_for_review']);
    expect(triggersFrom('in_review')).toEqual(['reject', 'approve']);
  });
});

// ---------------------------------------------------------------------------
// Conditions d'émission pour revue
// ---------------------------------------------------------------------------

describe('R12 — émettre pour revue', () => {
  it('une anomalie bloquante empêche l’émission et est rendue telle quelle', () => {
    const r = transitionSchedule('submit_for_review', context({
      findings: [blocking('WAYFIND.CONTINUITY_BROKEN')],
    }));
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(['WAYFIND.CONTINUITY_BROKEN']);
  });

  it('un avertissement n’empêche pas l’émission', () => {
    const r = transitionSchedule('submit_for_review', context({
      findings: [{
        code: 'LAYOUT.LANG_VARIANT_MISSING',
        severity: 'warning',
        entity: null,
        params: {},
        ruleRef: null,
      }],
    }));
    expect(r.ok).toBe(true);
  });

  /**
   * M02.W11, la quatrième décision arrêtée en R19 : faire relire un tableau
   * bâti sur un graphe incomplet reviendrait à faire valider une erreur.
   */
  it('un graphe non validé empêche l’émission, règle M02.W11', () => {
    const r = transitionSchedule('submit_for_review', context({ graphValidated: false }));
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(['GRAPH.NOT_VALIDATED']);
    if (!r.ok) expect(r.findings[0]?.ruleRef).toBe('M02.W11');
  });

  it('les deux causes se cumulent, l’une ne masque pas l’autre', () => {
    const r = transitionSchedule('submit_for_review', context({
      findings: [blocking('WAYFIND.NAMING_COLLISION')],
      graphValidated: false,
    }));
    expect(codes(r)).toEqual(['WAYFIND.NAMING_COLLISION', 'GRAPH.NOT_VALIDATED']);
  });

  it('un tableau en revue ne se régénère pas', () => {
    const r = transitionSchedule('regenerate', context({ schedule: schedule('in_review') }));
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(['EDIT.CONTEXT_VIOLATION']);
  });
});

// ---------------------------------------------------------------------------
// Conditions de rejet et d'approbation
// ---------------------------------------------------------------------------

describe('R12 — rejeter et approuver', () => {
  const inReview = schedule('in_review');

  it('un rejet sans motif est refusé', () => {
    const r = transitionSchedule('reject', context({ schedule: inReview }));
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(['EDIT.COMMAND_SHAPE_INVALID']);
  });

  it('un motif fait d’espaces ne vaut pas motif', () => {
    const r = transitionSchedule('reject', context({
      schedule: inReview,
      rejectionReason: '   ',
    }));
    expect(r.ok).toBe(false);
  });

  it('une annotation ouverte empêche l’approbation', () => {
    const r = transitionSchedule('approve', context({
      schedule: inReview,
      openAnnotationIds: ['ann-2', 'ann-1'],
    }));
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(['REVIEW.ANNOTATION_OPEN', 'REVIEW.ANNOTATION_OPEN']);
    // Ordre stable : l'annotation citée en premier est la même à chaque appel.
    if (!r.ok) expect(r.findings[0]?.entity?.id).toBe('ann-1');
  });

  it('une ligne périmée empêche l’approbation', () => {
    const r = transitionSchedule('approve', context({
      schedule: schedule('in_review', [line('l-1'), line('l-2', true)]),
    }));
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(['WAYFIND.SCHEDULE_STALE']);
    if (!r.ok) expect(r.findings[0]?.entity?.id).toBe('l-2');
  });

  /**
   * La péremption bloque l'approbation par la condition de R12, pas par sa
   * gravité : le catalogue en fait un avertissement, et l'essai fige les deux
   * faits ensemble pour qu'on ne requalifie pas l'anomalie afin de justifier
   * le refus.
   */
  it('la péremption refuse sans changer la gravité que le catalogue lui donne', () => {
    const r = transitionSchedule('approve', context({
      schedule: schedule('in_review', [line('l-1', true)]),
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings[0]?.severity).toBe('warning');
  });

  it('une anomalie bloquante n’empêche pas l’approbation d’une version déjà en revue', () => {
    // R12 ne la pose qu'à l'émission : une fois la version en revue, le
    // contenu est figé et ce sont les annotations qui portent la relecture.
    const r = transitionSchedule('approve', context({
      schedule: inReview,
      findings: [blocking('WAYFIND.CONTINUITY_BROKEN')],
    }));
    expect(r.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Remplacement
// ---------------------------------------------------------------------------

describe('R12 — remplacement par une version ultérieure', () => {
  it('sans version qui remplace, le remplacement est refusé', () => {
    const r = transitionSchedule('supersede', context({ schedule: schedule('approved') }));
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(['EDIT.COMMAND_SHAPE_INVALID']);
  });

  it('une version antérieure ne remplace pas', () => {
    const r = transitionSchedule('supersede', context({
      schedule: schedule('approved', [line('l-1')], 7),
      supersedingVersion: 6,
    }));
    expect(r.ok).toBe(false);
  });

  it('la même version ne se remplace pas elle-même', () => {
    const r = transitionSchedule('supersede', context({
      schedule: schedule('approved', [line('l-1')], 7),
      supersedingVersion: 7,
    }));
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Déterminisme (invariant 4)
// ---------------------------------------------------------------------------

describe('INV-4 — deux appels identiques rendent le même refus', () => {
  it('les anomalies sortent dans le même ordre, au même contenu', () => {
    const ctx = context({
      schedule: schedule('in_review', [line('l-3', true), line('l-1', true)]),
      openAnnotationIds: ['ann-9', 'ann-2'],
    });
    const first = transitionSchedule('approve', ctx);
    const second = transitionSchedule('approve', ctx);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(codes(first)).toEqual([
      'REVIEW.ANNOTATION_OPEN', 'REVIEW.ANNOTATION_OPEN',
      'WAYFIND.SCHEDULE_STALE', 'WAYFIND.SCHEDULE_STALE',
    ]);
  });

  it('un déclencheur permis ne rend aucun avertissement inventé', () => {
    const r = transitionSchedule('generate', context({ schedule: null }));
    if (r.ok) expect(r.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Les codes employés existent déjà
// ---------------------------------------------------------------------------

describe('R14 — cet écran ne crée aucun code', () => {
  it('tous les codes de refus sont au catalogue', async () => {
    const { ERROR_CATALOG } = await import('@azimut/core-model');
    const used = [
      'EDIT.CONTEXT_VIOLATION',
      'EDIT.COMMAND_SHAPE_INVALID',
      'GRAPH.NOT_VALIDATED',
      'REVIEW.ANNOTATION_OPEN',
      'WAYFIND.SCHEDULE_STALE',
    ];
    for (const code of used) {
      expect(Object.keys(ERROR_CATALOG)).toContain(code);
    }
  });
});
