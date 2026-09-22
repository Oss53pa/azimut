import { describe, it, expect } from 'vitest';
import type { MessageLine, MessageSchedule } from '../message-schedule.js';
import { messageLineId } from '../message-schedule.js';
import { LINE_CHANGES, diffSchedules, visibleDiffLines } from '../message-schedule-diff.js';
import type { LineDiff } from '../message-schedule-diff.js';

/**
 * R11 (partie R) — la comparaison de deux versions.
 *
 * Critère 7 de R18 : « La comparaison de deux versions distingue ajoutées,
 * supprimées et modifiées, **sans fausse suppression d'une ligne
 * regénérée**. » Ce dernier point est le seul qui puisse rendre la
 * comparaison inutilisable, et c'est lui que l'essai central éprouve : une
 * version entièrement regénérée, sans qu'aucune donnée n'ait bougé, ne doit
 * produire aucun écart.
 */

const LANGS = ['fr', 'en'] as const;

function line(over: Partial<MessageLine> = {}): MessageLine {
  const support = over.support_id ?? 'sup-1';
  const face = over.face_index ?? 0;
  const block = over.block_index ?? 0;
  const base: MessageLine = {
    id: messageLineId(support, face, block),
    support_id: support,
    face_index: face,
    block_index: block,
    block_kind: 'destination_list',
    entries: [{
      destination_id: 'dest-1',
      text: { fr: 'Gare routière', en: 'Bus station' },
      direction: 'left',
      distance_m: 40,
    }],
    pictogram_id: null,
    direction: 'left',
    information_level: 2,
    decision_point_id: 'n-hall',
    stale: false,
  };
  // L'identifiant reste celui de la position : c'est ce qui fait qu'une ligne
  // regénérée se retrouve, et l'essai ne doit pas pouvoir le contourner.
  return { ...base, ...over, id: base.id };
}

function schedule(version: number, lines: readonly MessageLine[]): MessageSchedule {
  return {
    site_id: 'site-1',
    version,
    state: 'approved',
    generated_at: '2026-04-01T00:00:00.000Z',
    inputs_hash: `hash-${String(version)}`,
    lines,
  };
}

function byId(lines: readonly LineDiff[], id: string): LineDiff {
  const found = lines.find(l => l.id === id);
  if (found === undefined) throw new Error(`ligne ${id} absente de la comparaison`);
  return found;
}

// ---------------------------------------------------------------------------
// Les quatre marques
// ---------------------------------------------------------------------------

describe('R11 (partie R) — les quatre marques', () => {
  const reference = schedule(6, [
    line(),
    line({ block_index: 1 }),
    line({ block_index: 2 }),
  ]);
  const compared = schedule(7, [
    line(),                                            // inchangée
    line({ block_index: 1, direction: 'right' }),      // modifiée
    line({ block_index: 3 }),                          // ajoutée
  ]);                                                  // bloc 2 : supprimée

  const diff = diffSchedules(reference, compared, LANGS);

  it('porte les quatre marques du document, et pas d’autres', () => {
    expect([...LINE_CHANGES]).toEqual(['added', 'removed', 'modified', 'unchanged']);
    const kinds = new Set(diff.lines.map(l => l.change));
    expect([...kinds].sort()).toEqual(['added', 'modified', 'removed', 'unchanged']);
  });

  it('une ligne absente de la référence est ajoutée', () => {
    const added = byId(diff.lines, messageLineId('sup-1', 0, 3));
    expect(added.change).toBe('added');
    expect(added.reference).toBeNull();
    expect(added.compared).not.toBeNull();
  });

  it('une ligne absente de la version comparée est supprimée', () => {
    const removed = byId(diff.lines, messageLineId('sup-1', 0, 2));
    expect(removed.change).toBe('removed');
    expect(removed.compared).toBeNull();
  });

  it('une ligne de même identifiant et d’attribut différent est modifiée', () => {
    const modified = byId(diff.lines, messageLineId('sup-1', 0, 1));
    expect(modified.change).toBe('modified');
    expect(modified.changes).toEqual([
      { field: 'direction', before: 'left', after: 'right' },
    ]);
  });

  it('compte chaque marque', () => {
    expect(diff.counts).toEqual({ added: 1, removed: 1, modified: 1, unchanged: 1 });
  });

  it('rappelle les deux versions comparées', () => {
    expect(diff.referenceVersion).toBe(6);
    expect(diff.comparedVersion).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Critère 7 de R18 — pas de fausse suppression
// ---------------------------------------------------------------------------

describe('R18 (partie R) critère 7 — aucune fausse suppression', () => {
  /**
   * La comparaison repose sur l'identifiant stable, dérivé du support, de la
   * face et du bloc. Une régénération produit des lignes neuves, mais le même
   * identifiant : si la comparaison portait sur un identifiant tiré à
   * l'écriture, chaque ligne paraîtrait supprimée puis ajoutée.
   */
  it('une version regénérée à l’identique ne montre aucun écart', () => {
    const lines = [line(), line({ block_index: 1 }), line({ support_id: 'sup-2' })];
    // Regénérées : objets neufs, mêmes valeurs.
    const again = lines.map(l => ({ ...l, entries: l.entries.map(e => ({ ...e })) }));

    const diff = diffSchedules(schedule(6, lines), schedule(7, again), LANGS);
    expect(diff.counts).toEqual({ added: 0, removed: 0, modified: 0, unchanged: 3 });
  });

  it('une ligne périmée puis rafraîchie n’est pas une modification', () => {
    // `stale` est dérivé (R10) : une ligne qui ne fait que devenir périmée
    // n'a pas changé de contenu, et la comparaison ne doit pas le dire.
    const diff = diffSchedules(
      schedule(6, [line({ stale: true })]),
      schedule(7, [line({ stale: false })]),
      LANGS,
    );
    expect(diff.counts.modified).toBe(0);
    expect(diff.counts.unchanged).toBe(1);
  });

  it('un tableau vide comparé à lui-même ne montre rien', () => {
    const diff = diffSchedules(schedule(1, []), schedule(2, []), LANGS);
    expect(diff.lines).toEqual([]);
    expect(diff.counts).toEqual({ added: 0, removed: 0, modified: 0, unchanged: 0 });
  });

  it('une première version n’est faite que d’ajouts', () => {
    const diff = diffSchedules(schedule(0, []), schedule(1, [line(), line({ block_index: 1 })]), LANGS);
    expect(diff.counts.added).toBe(2);
    expect(diff.counts.removed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Les écarts, champ par champ
// ---------------------------------------------------------------------------

describe('R11 (partie R) — la valeur ancienne et la nouvelle, côte à côte', () => {
  function changesFor(over: Partial<MessageLine>): readonly { field: string; before: string; after: string }[] {
    const diff = diffSchedules(
      schedule(6, [line()]),
      schedule(7, [line(over)]),
      LANGS,
    );
    return byId(diff.lines, messageLineId('sup-1', 0, 0)).changes;
  }

  it('un contenu changé se rapporte par langue', () => {
    const changes = changesFor({
      entries: [{
        destination_id: 'dest-1',
        text: { fr: 'Gare des cars', en: 'Bus station' },
        direction: 'left',
        distance_m: 40,
      }],
    });
    expect(changes).toEqual([
      { field: 'content.fr', before: 'Gare routière', after: 'Gare des cars' },
    ]);
  });

  it('un niveau d’information changé se rapporte', () => {
    expect(changesFor({ information_level: 3 })).toEqual([
      { field: 'information_level', before: '2', after: '3' },
    ]);
  });

  it('un point de décision changé se rapporte', () => {
    expect(changesFor({ decision_point_id: 'n-parvis' })).toEqual([
      { field: 'decision_point_id', before: 'n-hall', after: 'n-parvis' },
    ]);
  });

  it('un pictogramme posé se rapporte, avec sa valeur vide d’avant', () => {
    expect(changesFor({ pictogram_id: 'picto-9' })).toEqual([
      { field: 'pictogram_id', before: '', after: 'picto-9' },
    ]);
  });

  it('une destination changée se rapporte', () => {
    const changes = changesFor({
      entries: [{
        destination_id: 'dest-2',
        text: { fr: 'Gare routière', en: 'Bus station' },
        direction: 'left',
        distance_m: 40,
      }],
    });
    expect(changes).toEqual([
      { field: 'destinations', before: 'dest-1', after: 'dest-2' },
    ]);
  });

  it('plusieurs écarts sur une même ligne sont tous rapportés', () => {
    const changes = changesFor({ direction: 'up', information_level: 4 });
    expect(changes.map(c => c.field).sort()).toEqual(['direction', 'information_level']);
  });

  it('une ligne ajoutée ou supprimée ne porte aucun écart de champ', () => {
    const diff = diffSchedules(schedule(6, [line()]), schedule(7, [line({ block_index: 1 })]), LANGS);
    for (const entry of diff.lines) expect(entry.changes, entry.id).toEqual([]);
  });

  /** Seules les langues actives ont une colonne (R5, N1.2). */
  it('une langue non active ne produit aucun écart', () => {
    const diff = diffSchedules(
      schedule(6, [line()]),
      schedule(7, [line({
        entries: [{
          destination_id: 'dest-1',
          text: { fr: 'Gare routière', en: 'Coach station' },
          direction: 'left',
          distance_m: 40,
        }],
      })]),
      ['fr'],
    );
    expect(byId(diff.lines, messageLineId('sup-1', 0, 0)).changes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Présentation et déterminisme
// ---------------------------------------------------------------------------

describe('R11 (partie R) — inchangées masquées, ordre stable', () => {
  const diff = diffSchedules(
    schedule(6, [line(), line({ block_index: 1 })]),
    schedule(7, [line(), line({ block_index: 1, direction: 'right' })]),
    LANGS,
  );

  it('les inchangées sont masquées par défaut', () => {
    expect(visibleDiffLines(diff, false).map(l => l.change)).toEqual(['modified']);
  });

  it('et se montrent à la demande', () => {
    expect(visibleDiffLines(diff, true)).toHaveLength(2);
  });

  /** INV-4 — deux comparaisons du même couple rendent le même résultat. */
  it('deux comparaisons identiques rendent le même résultat', () => {
    const again = diffSchedules(
      schedule(6, [line(), line({ block_index: 1 })]),
      schedule(7, [line(), line({ block_index: 1, direction: 'right' })]),
      LANGS,
    );
    expect(JSON.stringify(again)).toBe(JSON.stringify(diff));
  });

  it('les lignes sortent dans l’ordre de leur identifiant, quel que soit l’ordre d’entrée', () => {
    const forward = diffSchedules(
      schedule(6, [line({ block_index: 1 }), line()]),
      schedule(7, [line(), line({ block_index: 1 })]),
      LANGS,
    );
    expect(forward.lines.map(l => l.id)).toEqual([
      messageLineId('sup-1', 0, 0),
      messageLineId('sup-1', 0, 1),
    ]);
  });
});
