/**
 * R12 (partie R) — circuit de validation du tableau des messages.
 *
 * M02.W7 : « Le tableau des messages est versionné et validé selon le même
 * circuit que les bons à tirer. » R12 transpose pour lui la machine à états de
 * la section D9.1, et c'est cette table, et elle seule, qui est écrite ici :
 * six transitions, aucune autre. Un état de départ et un déclencheur qui ne
 * s'y trouvent pas ne produisent pas d'état d'arrivée.
 *
 * Le fichier est pur. Il ne lit ni horloge, ni base, ni réseau, et il n'écrit
 * rien : il dit si une transition est permise, et sinon pourquoi. L'écriture
 * de la transition permise revient au chemin de commandes du module 02, et le
 * déclenchement à l'écran de la partie R.
 *
 * Aucun code d'anomalie n'est créé ici. Ceux qui refusent sont ceux que R14
 * (partie R) et le catalogue D2.2 portent déjà.
 */

import type { Finding, Outcome } from '@azimut/core-model';
import type { MessageSchedule, ScheduleState } from './message-schedule.js';

// ---------------------------------------------------------------------------
// Déclencheurs et table de transition
// ---------------------------------------------------------------------------

/**
 * Les six déclencheurs de la table R12, un par ligne.
 *
 * `generate` et `regenerate` sont distincts parce que R12 en fait deux lignes
 * distinctes : la première crée la première version, la seconde remplace un
 * brouillon. Les confondre laisserait régénérer par-dessus une version en
 * revue, que R12 interdit — « l'émission pour revue fige le contenu ».
 */
export const SCHEDULE_TRIGGERS = [
  'generate',
  'regenerate',
  'submit_for_review',
  'reject',
  'approve',
  'supersede',
] as const;

export type ScheduleTrigger = (typeof SCHEDULE_TRIGGERS)[number];

export type ScheduleTransitionRule = {
  /** État de départ. `null` : aucune version n'existe encore. */
  readonly from: ScheduleState | null;
  readonly to: ScheduleState;
  readonly trigger: ScheduleTrigger;
};

/** La table R12, ligne pour ligne, dans son ordre. */
export const SCHEDULE_TRANSITIONS: readonly ScheduleTransitionRule[] = [
  { from: null, to: 'draft', trigger: 'generate' },
  { from: 'draft', to: 'draft', trigger: 'regenerate' },
  { from: 'draft', to: 'in_review', trigger: 'submit_for_review' },
  { from: 'in_review', to: 'draft', trigger: 'reject' },
  { from: 'in_review', to: 'approved', trigger: 'approve' },
  { from: 'approved', to: 'superseded', trigger: 'supersede' },
];

/**
 * Les déclencheurs que la table permet depuis un état donné.
 *
 * Sert à l'écran de la partie R, dont la section R4 veut qu'une action non
 * permise soit absente et jamais grisée : une action absente de cette liste
 * n'a pas à être dessinée. La permission de rôle s'y ajoute, elle ne s'y
 * substitue pas.
 */
export function triggersFrom(
  current: ScheduleState | null,
): readonly ScheduleTrigger[] {
  return SCHEDULE_TRANSITIONS
    .filter(rule => rule.from === current)
    .map(rule => rule.trigger);
}

// ---------------------------------------------------------------------------
// Contexte et résultat
// ---------------------------------------------------------------------------

/**
 * Ce dont les conditions de R12 ont besoin, et rien de plus.
 *
 * Chaque champ est fourni par l'appelant plutôt que recalculé ici : la
 * validation de complétude appartient au moteur de graphe, les annotations à
 * la partie J, les anomalies aux contrôles du tableau. Les redériver ici
 * ferait deux vérités là où l'invariant 1 n'en veut qu'une.
 */
export type ScheduleTransitionContext = {
  /** Le tableau visé. `null` quand aucune version n'existe encore. */
  readonly schedule: MessageSchedule | null;
  /**
   * Les anomalies portées par le tableau, telles que les contrôles les
   * rendent. Seules les bloquantes empêchent l'émission pour revue.
   */
  readonly findings: readonly Finding[];
  /** M02.W11 : la validation de complétude du graphe est-elle passée ? */
  readonly graphValidated: boolean;
  /** Identifiants des annotations de révision ouvertes sur le tableau. */
  readonly openAnnotationIds: readonly string[];
  /** Motif du rejet. Obligatoire pour `reject`, ignoré ailleurs. */
  readonly rejectionReason: string | null;
  /** Numéro de la version approuvée qui remplace celle-ci, pour `supersede`. */
  readonly supersedingVersion: number | null;
};

export type ScheduleTransition = {
  readonly from: ScheduleState | null;
  readonly to: ScheduleState;
  readonly trigger: ScheduleTrigger;
};

// ---------------------------------------------------------------------------
// Refus
// ---------------------------------------------------------------------------

function refusal(
  code: string,
  params: Record<string, string | number>,
  entity: { kind: string; id: string } | null,
  ruleRef: string | null,
  severity: Finding['severity'] = 'blocking',
): Finding {
  return { code, severity, entity, params, ruleRef };
}

function scheduleEntity(
  schedule: MessageSchedule | null,
): { kind: string; id: string } | null {
  if (schedule === null) return null;
  return { kind: 'message_schedule', id: `${schedule.site_id}#${String(schedule.version)}` };
}

// ---------------------------------------------------------------------------
// La machine
// ---------------------------------------------------------------------------

/**
 * Dit si un déclencheur est permis dans le contexte donné, et rend la
 * transition qu'il produirait.
 *
 * Refuse dans cinq cas, tous écrits dans la colonne « Condition » de R12 :
 *
 *  · le couple état et déclencheur n'est pas dans la table, `EDIT.CONTEXT_VIOLATION` ;
 *  · une anomalie bloquante subsiste à l'émission pour revue, et ce sont ces
 *    anomalies-là qui sont rendues ;
 *  · la validation de complétude du graphe n'est pas passée, `GRAPH.NOT_VALIDATED`,
 *    règle M02.W11 ;
 *  · une annotation de révision est ouverte à l'approbation, `REVIEW.ANNOTATION_OPEN` ;
 *  · une ligne est périmée à l'approbation, `WAYFIND.SCHEDULE_STALE`.
 *
 * Deux refus de forme s'y ajoutent, quand l'appelant donne une commande que
 * R12 ne permet pas de lire : un rejet sans motif, un remplacement par une
 * version qui n'est pas ultérieure.
 *
 * Le rattachement d'un paquet de règles n'est pas une condition d'émission :
 * R12 renvoie à R14, qui en fait un bandeau et non un blocage, et N2.8 dit
 * que le plafond de M02.W9 ne s'exécute alors pas et le signale.
 */
export function transitionSchedule(
  trigger: ScheduleTrigger,
  context: ScheduleTransitionContext,
): Outcome<ScheduleTransition> {
  const { schedule } = context;
  const current: ScheduleState | null = schedule === null ? null : schedule.state;
  const entity = scheduleEntity(schedule);

  const rule = SCHEDULE_TRANSITIONS.find(
    r => r.from === current && r.trigger === trigger,
  );
  if (rule === undefined) {
    return {
      ok: false,
      findings: [refusal('EDIT.CONTEXT_VIOLATION', {
        from: current ?? 'aucune',
        trigger,
      }, entity, 'R12')],
    };
  }

  const findings = conditionsOf(trigger, context, entity);
  if (findings.length > 0) return { ok: false, findings };

  return {
    ok: true,
    value: { from: current, to: rule.to, trigger },
    warnings: [],
  };
}

function conditionsOf(
  trigger: ScheduleTrigger,
  context: ScheduleTransitionContext,
  entity: { kind: string; id: string } | null,
): Finding[] {
  switch (trigger) {
    case 'submit_for_review':
      return submitConditions(context, entity);
    case 'reject':
      return rejectConditions(context, entity);
    case 'approve':
      return approveConditions(context);
    case 'supersede':
      return supersedeConditions(context, entity);
    case 'generate':
    case 'regenerate':
      return [];
  }
}

/**
 * R12 : « Aucune anomalie bloquante, et validation de complétude du graphe
 * passée, règle M02.W11. »
 *
 * Les anomalies bloquantes sont rendues telles quelles : elles portent déjà
 * leur code, leur entité et leur référence, et les réécrire ici les
 * détacherait de l'endroit où elles se corrigent.
 */
function submitConditions(
  context: ScheduleTransitionContext,
  entity: { kind: string; id: string } | null,
): Finding[] {
  const findings: Finding[] = context.findings
    .filter(f => f.severity === 'blocking')
    .map(f => ({ ...f }));

  // M02.W11, décision arrêtée en R19 : faire relire un tableau bâti sur un
  // graphe incomplet reviendrait à faire valider une erreur.
  if (!context.graphValidated) {
    findings.push(refusal('GRAPH.NOT_VALIDATED', {}, entity, 'M02.W11'));
  }

  return findings;
}

/** R12 : « Rejeter | Motif obligatoire ». */
function rejectConditions(
  context: ScheduleTransitionContext,
  entity: { kind: string; id: string } | null,
): Finding[] {
  const reason = context.rejectionReason ?? '';
  if (reason.trim() !== '') return [];
  return [refusal('EDIT.COMMAND_SHAPE_INVALID', {
    trigger: 'reject',
    field: 'rejectionReason',
  }, entity, 'R12')];
}

/**
 * R12 : « Approuver | Aucune annotation ouverte, aucune ligne périmée ».
 *
 * `WAYFIND.SCHEDULE_STALE` garde la gravité que le catalogue lui donne,
 * avertissement : ce qui bloque n'est pas sa gravité, c'est la condition de
 * R12. Les deux sont distincts et le refus le dit par `ok: false`, pas en
 * requalifiant l'anomalie.
 */
function approveConditions(
  context: ScheduleTransitionContext,
): Finding[] {
  const findings: Finding[] = [];

  for (const id of [...context.openAnnotationIds].sort((a, b) => a.localeCompare(b))) {
    findings.push(refusal('REVIEW.ANNOTATION_OPEN', {}, {
      kind: 'review_annotation', id,
    }, 'R12'));
  }

  const stale = (context.schedule?.lines ?? []).filter(line => line.stale);
  for (const line of [...stale].sort((a, b) => a.id.localeCompare(b.id))) {
    findings.push(refusal('WAYFIND.SCHEDULE_STALE', {
      support_id: line.support_id,
    }, { kind: 'message_line', id: line.id }, 'R12', 'warning'));
  }

  return findings;
}

/**
 * R12 : « Approbation d'une version ultérieure | Automatique ».
 *
 * Automatique ne veut pas dire sans condition : la version qui remplace doit
 * être ultérieure. Une version qui se ferait remplacer par une antérieure
 * ferait disparaître l'ordre des approbations.
 */
function supersedeConditions(
  context: ScheduleTransitionContext,
  entity: { kind: string; id: string } | null,
): Finding[] {
  const superseding = context.supersedingVersion;
  const version = context.schedule?.version ?? 0;
  if (superseding !== null && superseding > version) return [];
  return [refusal('EDIT.COMMAND_SHAPE_INVALID', {
    trigger: 'supersede',
    field: 'supersedingVersion',
    version,
    superseding: superseding ?? 'aucune',
  }, entity, 'R12')];
}
