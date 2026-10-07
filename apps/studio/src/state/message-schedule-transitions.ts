/**
 * R12 (partie R) — les transitions du tableau des messages, en commandes.
 *
 * Ce module ne juge pas : la machine de R12 (`transitionSchedule`) dit si un
 * déclencheur est permis, et ses refus sont rendus tels quels. Ce module
 * traduit une transition permise en écritures, toutes d'un seul geste :
 *
 *  · émettre pour revue : l'état passe de `draft` à `in_review` ;
 *  · rejeter : l'état revient à `draft`, et une décision `rejected` s'écrit
 *    dans `message_schedule_approval`, portant le motif ;
 *  · approuver : l'état passe à `approved`, une décision `approved` s'écrit,
 *    et la version approuvée précédente passe à `superseded` — R12,
 *    « Automatique ».
 *
 * La décision ne porte ni approbateur ni date : la base les pose (0074), et
 * refuse un approbateur qui ne serait pas l'utilisateur de la session. Elle
 * porte l'empreinte des entrées du tableau jugé, celle qu'il avait au moment
 * de la décision. Aucune écriture dans `approval`, qui appartient au module 04
 * (R12).
 *
 * Générer et régénérer relèvent de la moitié génération : ils ne passent pas
 * par ici.
 */
import type { EntityCommand, Finding, Outcome } from '@azimut/core-model';
import { buildCommand } from '@azimut/core-model';
import { transitionSchedule } from '@azimut/engine-graph';
import type {
  MessageSchedule, ScheduleState, ScheduleTransitionContext, ScheduleTrigger,
} from '@azimut/engine-graph';

const MODULE = '02-wayfinding';

/** Les déclencheurs que ce module traduit. */
export type DecisionTrigger = Extract<ScheduleTrigger, 'submit_for_review' | 'reject' | 'approve'>;

/** Un tableau enregistré : son identifiant de stockage et son contenu. */
export type StoredSchedule = {
  readonly id: string;
  readonly schedule: MessageSchedule;
};

/** Ce que les conditions de R12 lisent, hors le tableau lui-même. */
export type TransitionConditions = Omit<ScheduleTransitionContext, 'schedule' | 'supersedingVersion'>;

export type TransitionWrite = {
  readonly orgId: string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
  /** Identifiant de la décision, tiré par l'appelant. Ignoré à l'émission. */
  readonly decisionId: string;
};

/**
 * Les écritures d'une transition, ou les refus de R12.
 *
 * `approved` est la version actuellement approuvée du site, s'il y en a une :
 * l'approbation d'une version ultérieure la remplace.
 */
export function transitionCommands(
  trigger: DecisionTrigger,
  target: StoredSchedule,
  conditions: TransitionConditions,
  approved: StoredSchedule | null,
  write: TransitionWrite,
): Outcome<readonly EntityCommand[]> {
  const verdict = transitionSchedule(trigger, {
    ...conditions, schedule: target.schedule, supersedingVersion: null,
  });
  if (!verdict.ok) return verdict;

  const groupKey = `schedule-transition:${target.id}:${write.timestamp}`;
  const commands: EntityCommand[] = [];
  const push = (built: Outcome<EntityCommand>): Finding[] | null => {
    if (!built.ok) return [...built.findings];
    commands.push(built.value);
    return null;
  };

  const moved = push(stateCommand(target, verdict.value.to, write, groupKey));
  if (moved !== null) return { ok: false, findings: moved };

  if (trigger === 'reject' || trigger === 'approve') {
    const decided = push(buildCommand({
      operation: 'create', module: MODULE, table: 'message_schedule_approval',
      id: write.decisionId, org_id: write.orgId, timestamp: write.timestamp, groupKey,
      after: {
        id: write.decisionId,
        org_id: write.orgId,
        schedule_id: target.id,
        decision: trigger === 'approve' ? 'approved' : 'rejected',
        // `transitionSchedule` a déjà refusé un rejet sans motif.
        comment: trigger === 'reject' ? (conditions.rejectionReason ?? '').trim() : null,
        inputs_hash: target.schedule.inputs_hash,
      },
    }));
    if (decided !== null) return { ok: false, findings: decided };
  }

  if (trigger === 'approve' && approved !== null && approved.id !== target.id) {
    const superseded = transitionSchedule('supersede', {
      ...conditions, schedule: approved.schedule, supersedingVersion: target.schedule.version,
    });
    if (!superseded.ok) return superseded;
    const replaced = push(stateCommand(approved, superseded.value.to, write, groupKey));
    if (replaced !== null) return { ok: false, findings: replaced };
  }

  return { ok: true, value: commands, warnings: [] };
}

function stateCommand(
  stored: StoredSchedule, to: ScheduleState, write: TransitionWrite, groupKey: string,
): Outcome<EntityCommand> {
  return buildCommand({
    operation: 'update', module: MODULE, table: 'message_schedule', id: stored.id,
    org_id: write.orgId, timestamp: write.timestamp, groupKey,
    before: { state: stored.schedule.state }, after: { state: to },
  });
}
