/**
 * Chemin d'écriture du tableau des messages.
 *
 * Un tableau et ses lignes s'écrivent en un seul geste, et le geste est tout
 * ou rien : un tableau enregistré à qui il manquerait des lignes ferait
 * valider à la maîtrise d'ouvrage un document incomplet sans que rien ne le
 * dise. `groupKey` porte cette unité, et la transaction du chemin d'écriture
 * la garantit.
 *
 * Ce module traduit, il ne décide pas. Le tableau lui arrive tel que le
 * générateur l'a produit (M02.W6) ; ce qu'il refuse, il le refuse parce que le
 * modèle de N2.2 l'exige, jamais parce qu'il en jugerait le contenu.
 */
import type { EntityCommand, Finding, Outcome } from '@azimut/core-model';
import { buildCommand } from '@azimut/core-model';
import type { MessageLine, MessageSchedule } from '@azimut/engine-graph';

const MODULE = '02-wayfinding';

export type ScheduleWrite = {
  readonly orgId: string;
  readonly siteId: string;
  /** Identifiant du tableau, tiré par l'appelant. */
  readonly scheduleId: string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
  /** Un identifiant par ligne, dans l'ordre des lignes du tableau. */
  readonly lineIds: readonly string[];
};

/**
 * N2.2 et R12 — les quatre états, et eux seuls.
 *
 * Le générateur rend aujourd'hui `pending`, hérité du vocabulaire des bons à
 * tirer. Ce n'est pas un état de tableau : R12 fait reposer l'émission pour
 * revue sur `in_review`, qui n'existe pas dans ce vocabulaire-là. Un tableau
 * généré entre donc en `draft`, qui est bien ce qu'il est, et la traduction
 * est faite ici plutôt que devinée par la base.
 */
export const SCHEDULE_STATES = ['draft', 'in_review', 'approved', 'superseded'] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

/** N2.2 — les six directions, relatives à l'usager. */
export const LINE_DIRECTIONS = ['left', 'right', 'ahead', 'up', 'down', 'back'] as const;
export type LineDirection = (typeof LINE_DIRECTIONS)[number];

/** L'écartement d'une ligne par l'arbitrage de M02.W9, et son motif. */
export type Exclusion = {
  readonly cap: number;
  readonly ruleRef: string;
  readonly excludedPriority: number;
  readonly lastKeptPriority: number;
};

function shapeRefusal(
  field: string,
  params: Record<string, string | number>,
  id: string,
): Finding {
  return {
    code: 'EDIT.COMMAND_SHAPE_INVALID',
    severity: 'blocking',
    entity: { kind: 'command', id },
    params: { field, ...params },
    ruleRef: null,
  };
}

function isLineDirection(value: string | null): value is LineDirection | null {
  return value === null || LINE_DIRECTIONS.some(d => d === value);
}

/**
 * Les commandes d'écriture d'un tableau et de toutes ses lignes.
 *
 * `excluded` porte, ligne par ligne, ce que l'arbitrage de M02.W9 a écarté. Une
 * ligne écartée s'écrit quand même : M02.W9 veut que l'écartement soit tracé,
 * jamais silencieux, et R9 la montre à la maîtrise d'ouvrage pour qu'elle
 * puisse faire changer une priorité à la source.
 */
export function writeScheduleCommands(
  schedule: MessageSchedule,
  write: ScheduleWrite,
  excluded: ReadonlyMap<string, Exclusion> = new Map(),
): Outcome<readonly EntityCommand[]> {
  if (write.lineIds.length !== schedule.lines.length) {
    return {
      ok: false,
      findings: [shapeRefusal('lineIds', {
        attendus: schedule.lines.length,
        recus: write.lineIds.length,
      }, write.scheduleId)],
    };
  }

  const groupKey = `message_schedule:${write.scheduleId}`;
  const commands: EntityCommand[] = [];

  const head = buildCommand({
    operation: 'create',
    module: MODULE,
    table: 'message_schedule',
    id: write.scheduleId,
    org_id: write.orgId,
    after: {
      id: write.scheduleId,
      org_id: write.orgId,
      site_id: write.siteId,
      version: schedule.version,
      // Un tableau qu'on vient de générer est un brouillon. L'émission pour
      // revue est une transition séparée (R12), et elle exige M02.W11.
      state: 'draft',
      generated_at: schedule.generated_at,
      inputs_hash: schedule.inputs_hash,
    },
    timestamp: write.timestamp,
    groupKey,
  });
  if (!head.ok) return head;
  commands.push(head.value);

  for (const [index, line] of schedule.lines.entries()) {
    const id = write.lineIds[index];
    if (id === undefined) continue;
    const built = lineCommand(line, id, write, groupKey, excluded.get(line.id));
    if (!built.ok) return built;
    commands.push(built.value);
  }

  return { ok: true, value: commands, warnings: [] };
}

function lineCommand(
  line: MessageLine,
  id: string,
  write: ScheduleWrite,
  groupKey: string,
  exclusion: Exclusion | undefined,
): Outcome<EntityCommand> {
  // M02.W4, et le critère 4 de N2.7 : « une ligne sans point de décision ne peut
  // pas être créée ». La colonne est NOT NULL en base ; le refus ici nomme la
  // règle au lieu de laisser la base rendre une violation de contrainte.
  if (line.decision_point_id.trim() === '') {
    return {
      ok: false,
      findings: [{
        code: 'WAYFIND.LINE_UNJUSTIFIED',
        severity: 'blocking',
        entity: { kind: 'message_line', id },
        params: { support_id: line.support_id, face_index: line.face_index },
        ruleRef: null,
      }],
    };
  }

  if (line.information_level === null) {
    return {
      ok: false,
      findings: [{
        code: 'WAYFIND.NO_INFORMATION_LEVEL',
        severity: 'blocking',
        entity: { kind: 'message_line', id },
        params: { support_id: line.support_id },
        ruleRef: null,
      }],
    };
  }

  // N2.2 borne la direction d'une ligne aux six valeurs relatives à l'usager.
  // Le générateur porte aujourd'hui un relèvement au compas dans ses entrées
  // et laisse la direction de ligne nulle ; une valeur hors des six est donc
  // refusée plutôt qu'écrite, la base la refuserait de toute façon.
  if (!isLineDirection(line.direction)) {
    return {
      ok: false,
      findings: [shapeRefusal('direction', { direction: line.direction ?? '' }, id)],
    };
  }

  return buildCommand({
    operation: 'create',
    module: MODULE,
    table: 'message_line',
    id,
    org_id: write.orgId,
    after: {
      id,
      org_id: write.orgId,
      schedule_id: write.scheduleId,
      support_id: line.support_id,
      face_index: line.face_index,
      block_index: line.block_index,
      // Les entrées portent le texte par langue, la destination citée, la
      // direction et la distance. Les aplatir en une chaîne par langue
      // perdrait ce que R5 (partie R) affiche en colonnes distinctes.
      content: JSON.stringify({ block_kind: line.block_kind, entries: line.entries }),
      pictogram_id: line.pictogram_id,
      direction: line.direction,
      information_level: line.information_level,
      decision_point_id: line.decision_point_id,
      stale: line.stale,
      excluded: exclusion !== undefined,
      exclusion_reason: exclusion === undefined ? null : JSON.stringify({
        cap: exclusion.cap,
        rule_ref: exclusion.ruleRef,
        excluded_priority: exclusion.excludedPriority,
        last_kept_priority: exclusion.lastKeptPriority,
      }),
    },
    timestamp: write.timestamp,
    groupKey,
  });
}
