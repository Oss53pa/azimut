/**
 * H2.5 + H2.6 — Péremption et contrôles du tableau des messages.
 *
 * Deux responsabilités distinctes :
 *
 *   - la péremption, qui compare un tableau enregistré au tableau que
 *     les données produiraient aujourd'hui, et marque les lignes
 *     concernées plutôt que le tableau entier ;
 *   - les contrôles, qui appliquent les principes déclarés du site.
 *
 * Aucun seuil n'est écrit ici : un principe absent vaut « non
 * contrôlé », jamais une valeur par défaut inventée.
 */

import type { Finding } from '@azimut/core-model';
import { lineFingerprint } from './message-schedule.js';
import type {
  MessageLine,
  MessageSchedule,
  WayfindingRules,
} from './message-schedule.js';

// ---------------------------------------------------------------------------
// Péremption
// ---------------------------------------------------------------------------

export type StaleDiff = {
  /** Tableau enregistré, drapeaux de péremption remis à jour. */
  readonly schedule: MessageSchedule;
  /** Lignes dont le contenu a changé. */
  readonly changedIds: readonly string[];
  /** Lignes qui n'existent plus dans les données. */
  readonly removedIds: readonly string[];
  /** Lignes que les données produisent et que le tableau n'a pas. */
  readonly addedIds: readonly string[];
};

/**
 * Marque comme périmées les lignes du tableau enregistré dont le
 * contenu ne correspond plus aux données (H2.5).
 *
 * Une ligne disparue est périmée aussi : elle décrit un message qui
 * n'a plus lieu d'être.
 */
export function refreshStaleFlags(
  stored: MessageSchedule,
  fresh: MessageSchedule,
): StaleDiff {
  const freshById = new Map(fresh.lines.map(l => [l.id, l]));
  const storedIds = new Set(stored.lines.map(l => l.id));

  const changedIds: string[] = [];
  const removedIds: string[] = [];

  const lines = stored.lines.map((line): MessageLine => {
    const current = freshById.get(line.id);
    if (current === undefined) {
      removedIds.push(line.id);
      return { ...line, stale: true };
    }
    if (lineFingerprint(line) !== lineFingerprint(current)) {
      changedIds.push(line.id);
      return { ...line, stale: true };
    }
    return { ...line, stale: false };
  });

  const addedIds = fresh.lines
    .filter(l => !storedIds.has(l.id))
    .map(l => l.id);

  return {
    schedule: { ...stored, lines },
    changedIds,
    removedIds,
    addedIds,
  };
}

// ---------------------------------------------------------------------------
// Contrôles
// ---------------------------------------------------------------------------

function countDestinationsPerFace(
  lines: readonly MessageLine[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (line.block_kind !== 'destination_list') continue;
    const key = `${line.support_id}#${String(line.face_index)}`;
    counts.set(key, (counts.get(key) ?? 0) + line.entries.length);
  }
  return counts;
}

/**
 * Contrôles du tableau : nombre de destinations par face, rattachement
 * à un niveau d'information, péremption.
 *
 * Les codes employés sont ceux de H12.
 */
export function checkMessageSchedule(
  schedule: MessageSchedule,
  rules: WayfindingRules,
): readonly Finding[] {
  const findings: Finding[] = [];

  // H2.6 — nombre maximal de destinations par face
  const max = rules.max_destinations_per_face;
  if (max !== null) {
    const counts = countDestinationsPerFace(schedule.lines);
    const keys = [...counts.keys()].sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      const count = counts.get(key) ?? 0;
      if (count <= max) continue;
      findings.push({
        code: 'WAYFIND.TOO_MANY_DESTINATIONS',
        severity: 'blocking',
        entity: { kind: 'message_face', id: key },
        params: { count, max },
        ruleRef: 'H2.6',
      });
    }
  }

  // H2.3 — un support sans niveau d'information existe sans raison.
  // Signalé une fois par support, pas une fois par ligne.
  const supportsWithoutLevel = new Set<string>();
  for (const line of schedule.lines) {
    if (line.information_level === null) supportsWithoutLevel.add(line.support_id);
  }
  for (const supportId of [...supportsWithoutLevel].sort((a, b) => a.localeCompare(b))) {
    findings.push({
      code: 'WAYFIND.NO_INFORMATION_LEVEL',
      severity: 'blocking',
      entity: { kind: 'support', id: supportId },
      params: {},
      ruleRef: 'H2.3',
    });
  }

  // H2.5 — péremption, une anomalie par ligne concernée
  for (const line of schedule.lines) {
    if (!line.stale) continue;
    findings.push({
      code: 'WAYFIND.SCHEDULE_STALE',
      severity: 'warning',
      entity: { kind: 'message_line', id: line.id },
      params: { support_id: line.support_id },
      ruleRef: 'H2.5',
    });
  }

  return findings;
}
