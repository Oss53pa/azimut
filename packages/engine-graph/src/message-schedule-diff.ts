/**
 * R11 (partie R) — comparaison de deux versions du tableau des messages.
 *
 * « Choix de deux versions. Affichage en un seul tableau, chaque ligne
 * marquée : Ajoutée, Supprimée, Modifiée, Inchangée. »
 *
 * Le rapprochement se fait par l'identifiant stable de ligne, et c'est ce qui
 * décide du résultat : « Sans lui, une ligne regénérée paraîtrait supprimée
 * puis ajoutée, et la comparaison serait inutilisable. » `messageLineId` le
 * dérive du support, de la face et du bloc — trois valeurs qu'une régénération
 * ne change pas —, et non d'un identifiant de ligne tiré à l'écriture, qui
 * serait neuf à chaque version.
 *
 * Module pur et déterministe (INV-4) : deux appels sur les mêmes versions
 * rendent les mêmes lignes, dans le même ordre, avec les mêmes écarts.
 */

import { lineFingerprint } from './message-schedule.js';
import type { MessageEntry, MessageLine, MessageSchedule } from './message-schedule.js';

/** R11 — les quatre marques, et elles seules. */
export const LINE_CHANGES = ['added', 'removed', 'modified', 'unchanged'] as const;

export type LineChange = (typeof LINE_CHANGES)[number];

/**
 * Un attribut qui diffère, avec ses deux valeurs.
 *
 * R11 : « La valeur ancienne et la nouvelle sont visibles côte à côte. » Le
 * champ est nommé par une clé que l'écran traduit ; les valeurs sont déjà
 * réduites en texte, parce que c'est sous cette forme que le tableau les
 * montre et que les comparer autrement ferait deux lectures du même écart.
 */
export type FieldChange = {
  /** `content.fr`, `direction`, `information_level`, … */
  readonly field: string;
  readonly before: string;
  readonly after: string;
};

export type LineDiff = {
  /** Identifiant stable de la ligne. */
  readonly id: string;
  readonly change: LineChange;
  /** La ligne dans la version de référence, absente si elle est ajoutée. */
  readonly reference: MessageLine | null;
  /** La ligne dans la version comparée, absente si elle est supprimée. */
  readonly compared: MessageLine | null;
  /** Vide sauf pour une ligne modifiée. */
  readonly changes: readonly FieldChange[];
};

export type DiffCounts = Readonly<Record<LineChange, number>>;

export type ScheduleDiff = {
  readonly referenceVersion: number;
  readonly comparedVersion: number;
  readonly lines: readonly LineDiff[];
  readonly counts: DiffCounts;
};

// ---------------------------------------------------------------------------
// Réduction d'un champ en texte
// ---------------------------------------------------------------------------

/** Le texte d'une ligne dans une langue, tel que la colonne de R5 (partie R) le montre. */
function contentOf(line: MessageLine, lang: string): string {
  return line.entries
    .map((entry: MessageEntry) => entry.text[lang] ?? '')
    .filter(written => written !== '')
    .join('\n');
}

function destinationsOf(line: MessageLine): string {
  return line.entries
    .map(entry => entry.destination_id)
    .filter((id): id is string => id !== null)
    .join(', ');
}

/**
 * Les attributs comparés, et eux seuls : ceux que R5 (partie R) met en colonne, plus le
 * type de bloc et les destinations citées, que le panneau de détail de R7
 * montre. `stale` n'en est pas : il est dérivé.
 */
function fieldsOf(
  line: MessageLine,
  langs: readonly string[],
): ReadonlyMap<string, string> {
  const fields = new Map<string, string>();
  for (const lang of langs) fields.set(`content.${lang}`, contentOf(line, lang));
  fields.set('destinations', destinationsOf(line));
  fields.set('block_kind', line.block_kind);
  fields.set('pictogram_id', line.pictogram_id ?? '');
  fields.set('direction', line.direction ?? '');
  fields.set(
    'information_level',
    line.information_level === null ? '' : String(line.information_level),
  );
  fields.set('decision_point_id', line.decision_point_id);
  return fields;
}

function changesBetween(
  reference: MessageLine,
  compared: MessageLine,
  langs: readonly string[],
): readonly FieldChange[] {
  const before = fieldsOf(reference, langs);
  const after = fieldsOf(compared, langs);

  const changes: FieldChange[] = [];
  for (const [field, value] of before) {
    const next = after.get(field) ?? '';
    if (next !== value) changes.push({ field, before: value, after: next });
  }
  return changes;
}

// ---------------------------------------------------------------------------
// La comparaison
// ---------------------------------------------------------------------------

/**
 * Compare deux versions.
 *
 * `reference` est la version de référence, `compared` celle qu'on lui oppose.
 * R11 en tire les deux marques asymétriques : une ligne absente de la
 * référence est **ajoutée**, une ligne absente de la version comparée est
 * **supprimée**.
 *
 * La modification se juge sur l'empreinte de contenu, la même que celle dont
 * dépend la péremption de M02.W8. Deux lignes de même empreinte sont
 * inchangées, et aucun écart de champ n'est alors calculé — il n'y en a pas.
 */
export function diffSchedules(
  reference: MessageSchedule,
  compared: MessageSchedule,
  langs: readonly string[],
): ScheduleDiff {
  const referenceById = new Map(reference.lines.map(line => [line.id, line]));
  const comparedById = new Map(compared.lines.map(line => [line.id, line]));

  const ids = [...new Set([...referenceById.keys(), ...comparedById.keys()])]
    .sort((a, b) => a.localeCompare(b));

  const lines = ids.map((id): LineDiff => {
    const before = referenceById.get(id) ?? null;
    const after = comparedById.get(id) ?? null;

    if (before === null && after !== null) {
      return { id, change: 'added', reference: null, compared: after, changes: [] };
    }
    if (before !== null && after === null) {
      return { id, change: 'removed', reference: before, compared: null, changes: [] };
    }
    if (before === null || after === null) {
      // Inatteignable : un identifiant vient d'au moins une des deux versions.
      return { id, change: 'unchanged', reference: before, compared: after, changes: [] };
    }

    if (lineFingerprint(before) === lineFingerprint(after)) {
      return { id, change: 'unchanged', reference: before, compared: after, changes: [] };
    }
    return {
      id,
      change: 'modified',
      reference: before,
      compared: after,
      changes: changesBetween(before, after, langs),
    };
  });

  return {
    referenceVersion: reference.version,
    comparedVersion: compared.version,
    lines,
    counts: countOf(lines),
  };
}

function countOf(lines: readonly LineDiff[]): DiffCounts {
  const counts: Record<LineChange, number> = {
    added: 0, removed: 0, modified: 0, unchanged: 0,
  };
  for (const line of lines) counts[line.change] += 1;
  return counts;
}

/**
 * R11 : « Inchangée | Masquée par défaut. »
 *
 * Le filtre est une fonction et non un drapeau dans la comparaison : la
 * comparaison dit ce qui a changé, l'écran dit ce qu'il montre.
 */
export function visibleDiffLines(
  diff: ScheduleDiff,
  showUnchanged: boolean,
): readonly LineDiff[] {
  if (showUnchanged) return diff.lines;
  return diff.lines.filter(line => line.change !== 'unchanged');
}
