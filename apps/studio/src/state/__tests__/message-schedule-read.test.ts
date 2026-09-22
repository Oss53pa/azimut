import { describe, it, expect } from 'vitest';
import type { MessageLine, MessageSchedule } from '@azimut/engine-graph';
import { writeScheduleCommands } from '../message-schedule-commands.js';
import type { Exclusion } from '../message-schedule-commands.js';
import { EMPTY_SESSION, applyToSession } from '../session-store.js';
import type { SessionState } from '../session-store.js';
import { readSchedule, scheduleVersions } from '../message-schedule-read.js';

/**
 * La relecture d'un tableau enregistré, éprouvée contre le chemin qui l'a
 * écrit.
 *
 * L'essai n'invente aucune ligne de magasin : il écrit par
 * `writeScheduleCommands`, applique les commandes, puis relit. C'est le seul
 * moyen de savoir que les deux chemins se répondent, et pas seulement que
 * chacun fait quelque chose. Un tableau relu différent de celui qui a été
 * écrit ferait valider à la maîtrise d'ouvrage un document qui n'est pas
 * celui qu'on a produit.
 */

const ORG = 'org-1';
const SITE = 'site-1';
const SCHEDULE_ID = 'sched-1';

function line(over: Partial<MessageLine> = {}): MessageLine {
  return {
    id: 'sup-1#0#0',
    support_id: 'sup-1',
    face_index: 0,
    block_index: 0,
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
    ...over,
  };
}

function schedule(lines: readonly MessageLine[], version = 3): MessageSchedule {
  return {
    site_id: SITE,
    version,
    state: 'draft',
    generated_at: '2026-04-01T00:00:00.000Z',
    inputs_hash: 'abcd1234ef',
    lines,
  };
}

function store(
  source: MessageSchedule,
  exclusions: ReadonlyMap<string, Exclusion> = new Map(),
  scheduleId = SCHEDULE_ID,
): SessionState {
  const out = writeScheduleCommands(source, {
    orgId: ORG,
    siteId: SITE,
    scheduleId,
    timestamp: '2026-04-01T00:00:00.000Z',
    lineIds: source.lines.map((_, index) => `${scheduleId}-line-${String(index)}`),
  }, exclusions);
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.value.reduce(applyToSession, EMPTY_SESSION);
}

describe('relecture d’un tableau enregistré', () => {
  it('rend exactement le tableau qui a été écrit', () => {
    const source = schedule([line(), line({
      id: 'sup-1#0#1', block_index: 1, direction: 'right', stale: true,
      entries: [{
        destination_id: 'dest-2',
        text: { fr: 'Café Étoilé', en: 'Starred café' },
        direction: 'right',
        distance_m: null,
      }],
    })]);

    const read = readSchedule(store(source), SITE);
    expect(read).not.toBeNull();
    expect(read?.schedule).toEqual(source);
  });

  it('rend null quand aucune version n’est enregistrée', () => {
    expect(readSchedule(EMPTY_SESSION, SITE)).toBeNull();
  });

  it('ignore les tableaux d’un autre site', () => {
    expect(readSchedule(store(schedule([line()])), 'site-2')).toBeNull();
  });

  it('reconstitue l’identifiant stable d’une ligne, pas son identifiant de stockage', () => {
    const read = readSchedule(store(schedule([line()])), SITE);
    expect(read?.schedule.lines[0]?.id).toBe('sup-1#0#0');
    expect(read?.rowIds.get('sup-1#0#0')).toBe(`${SCHEDULE_ID}-line-0`);
  });

  /** R9 : l'écartement est tracé, jamais silencieux. */
  it('rend l’écartement d’une ligne avec son motif', () => {
    const exclusion: Exclusion = {
      cap: 5, ruleRef: 'M02.W9', excludedPriority: 9, lastKeptPriority: 4,
    };
    const read = readSchedule(
      store(schedule([line()]), new Map([['sup-1#0#0', exclusion]])),
      SITE,
    );
    expect(read?.exclusions.get('sup-1#0#0')).toEqual(exclusion);
  });

  it('une ligne sans écartement n’en porte aucun', () => {
    const read = readSchedule(store(schedule([line()])), SITE);
    expect(read?.exclusions.size).toBe(0);
  });
});

describe('une ligne illisible est nommée, jamais devinée', () => {
  function corrupt(patch: Readonly<Record<string, unknown>>): SessionState {
    const state = store(schedule([line()]));
    return {
      ...state,
      rows: state.rows.map(row => row.table === 'message_line'
        ? { ...row, values: { ...row.values, ...patch } }
        : row),
    };
  }

  it('un contenu illisible écarte la ligne et la compte', () => {
    const read = readSchedule(corrupt({ content: 'pas du json' }), SITE);
    expect(read?.schedule.lines).toEqual([]);
    expect(read?.unreadable).toEqual([`${SCHEDULE_ID}-line-0`]);
  });

  /** M02.W4 : une ligne sans point de décision ne peut pas exister. */
  it('une ligne sans point de décision n’est pas affichée', () => {
    const read = readSchedule(corrupt({ decision_point_id: '' }), SITE);
    expect(read?.schedule.lines).toEqual([]);
    expect(read?.unreadable).toHaveLength(1);
  });

  it('un niveau d’information hors de 1 à 4 écarte la ligne', () => {
    const read = readSchedule(corrupt({ information_level: 9 }), SITE);
    expect(read?.schedule.lines).toEqual([]);
  });

  /** M02.W9 : un écartement sans motif lisible n'est pas un écartement. */
  it('une ligne écartée sans motif lisible est illisible, pas écartée sans raison', () => {
    const read = readSchedule(
      corrupt({ excluded: true, exclusion_reason: '{}' }),
      SITE,
    );
    expect(read?.schedule.lines).toEqual([]);
    expect(read?.unreadable).toHaveLength(1);
    expect(read?.exclusions.size).toBe(0);
  });

  it('une tête de tableau illisible ne rend aucun tableau', () => {
    const state = store(schedule([line()]));
    const broken: SessionState = {
      ...state,
      rows: state.rows.map(row => row.table === 'message_schedule'
        ? { ...row, values: { ...row.values, state: 'pending' } }
        : row),
    };
    expect(readSchedule(broken, SITE)).toBeNull();
  });
});

describe('plusieurs versions', () => {
  function twoVersions(): SessionState {
    const first = store(schedule([line()], 3), new Map(), 'sched-1');
    const second = writeScheduleCommands(schedule([line()], 4), {
      orgId: ORG, siteId: SITE, scheduleId: 'sched-2',
      timestamp: '2026-04-02T00:00:00.000Z',
      lineIds: ['sched-2-line-0'],
    });
    if (!second.ok) throw new Error('écriture refusée');
    return second.value.reduce(applyToSession, first);
  }

  it('la version affichée est la plus haute', () => {
    expect(readSchedule(twoVersions(), SITE)?.schedule.version).toBe(4);
  });

  it('les lignes affichées sont celles de cette version-là', () => {
    const read = readSchedule(twoVersions(), SITE);
    expect(read?.rowIds.get('sup-1#0#0')).toBe('sched-2-line-0');
  });

  /** R4 (partie R) : « Comparer | Au moins deux versions ». */
  it('les versions se comptent, de la plus haute à la plus basse', () => {
    expect(scheduleVersions(twoVersions(), SITE)).toEqual([4, 3]);
    expect(scheduleVersions(EMPTY_SESSION, SITE)).toEqual([]);
  });
});
