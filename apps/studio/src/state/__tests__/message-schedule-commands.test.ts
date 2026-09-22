import { describe, it, expect } from 'vitest';
import { writeScheduleCommands } from '../message-schedule-commands.js';
import type { Exclusion, ScheduleWrite } from '../message-schedule-commands.js';
import type { MessageLine, MessageSchedule } from '@azimut/engine-graph';

const WRITE: ScheduleWrite = {
  orgId: 'aaaaaaaa-0000-0000-0000-000000000001',
  siteId: 'ssssssss-0000-0000-0000-000000000001',
  scheduleId: 'mmmmmmmm-0000-0000-0000-000000000001',
  timestamp: '2026-09-22T10:00:00.000Z',
  lineIds: ['llllllll-0000-0000-0000-000000000001', 'llllllll-0000-0000-0000-000000000002'],
};

function line(over: Partial<MessageLine> = {}): MessageLine {
  return {
    id: 'sup-1#0#0',
    support_id: 'sup-1',
    face_index: 0,
    block_index: 0,
    block_kind: 'destination_list',
    entries: [{
      destination_id: 'dest-1',
      text: { fr: 'Bureau RDC', en: 'Ground floor office' },
      direction: null,
      distance_m: 15.811,
    }],
    pictogram_id: null,
    direction: null,
    information_level: 2,
    decision_point_id: 'n-hall',
    stale: false,
    ...over,
  };
}

function schedule(lines: readonly MessageLine[]): MessageSchedule {
  return {
    site_id: WRITE.siteId,
    version: 7,
    state: 'pending',
    generated_at: '2026-09-22T09:00:00.000Z',
    inputs_hash: 'sha256:abc',
    lines,
  };
}

const TWO = schedule([line(), line({ id: 'sup-1#0#1', block_index: 1 })]);

describe('écriture du tableau des messages', () => {
  it('écrit le tableau puis ses lignes, sous un seul geste', () => {
    const out = writeScheduleCommands(TWO, WRITE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;

    expect(out.value.map(c => c.table)).toEqual([
      'message_schedule', 'message_line', 'message_line',
    ]);
    // E5.2 : un geste, une annulation. Un tableau à moitié défait n'aurait
    // aucun sens pour la maîtrise d'ouvrage qui le relit.
    const groups = new Set(out.value.map(c => c.groupKey));
    expect(groups.size).toBe(1);
  });

  it('entre en brouillon, et non dans le vocabulaire des bons à tirer', () => {
    // N2.2 et R12 : draft, in_review, approved, superseded. Le générateur rend
    // aujourd'hui `pending`, qui n'est pas un état de tableau.
    const out = writeScheduleCommands(TWO, WRITE);
    if (!out.ok) throw new Error('refus inattendu');
    expect(out.value[0]?.after?.['state']).toBe('draft');
  });

  it('reporte la version et l’empreinte des entrées telles qu’elles sont', () => {
    const out = writeScheduleCommands(TWO, WRITE);
    if (!out.ok) throw new Error('refus inattendu');
    expect(out.value[0]?.after?.['version']).toBe(7);
    expect(out.value[0]?.after?.['inputs_hash']).toBe('sha256:abc');
  });

  it('conserve les entrées, et non un texte aplati par langue', () => {
    const out = writeScheduleCommands(TWO, WRITE);
    if (!out.ok) throw new Error('refus inattendu');
    const content: unknown = JSON.parse(String(out.value[1]?.after?.['content']));
    const parsed = content as { block_kind: string; entries: { destination_id: string }[] };
    expect(parsed.block_kind).toBe('destination_list');
    expect(parsed.entries[0]?.destination_id).toBe('dest-1');
  });

  it('refuse autant d’identifiants que de lignes, ni plus ni moins', () => {
    const out = writeScheduleCommands(TWO, { ...WRITE, lineIds: ['un-seul'] });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings[0]?.code).toBe('EDIT.COMMAND_SHAPE_INVALID');
  });
});

describe('ce que l’écriture refuse, et sous quelle règle', () => {
  it('refuse une ligne sans point de décision (W4)', () => {
    const out = writeScheduleCommands(schedule([line({ decision_point_id: '' })]), {
      ...WRITE, lineIds: [WRITE.lineIds[0] ?? ''],
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings[0]?.code).toBe('WAYFIND.LINE_UNJUSTIFIED');
  });

  it('refuse une ligne sans niveau d’information (W3)', () => {
    const out = writeScheduleCommands(schedule([line({ information_level: null })]), {
      ...WRITE, lineIds: [WRITE.lineIds[0] ?? ''],
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings[0]?.code).toBe('WAYFIND.NO_INFORMATION_LEVEL');
  });

  it('refuse une direction hors des six valeurs de N2.2', () => {
    // Le générateur porte un relèvement au compas dans ses entrées. Écrire
    // « W » dans la colonne de direction violerait la contrainte de la base ;
    // le refus le dit avant l'aller-retour.
    const out = writeScheduleCommands(schedule([line({ direction: 'W' })]), {
      ...WRITE, lineIds: [WRITE.lineIds[0] ?? ''],
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings[0]?.params['field']).toBe('direction');
  });

  it('accepte les six directions, et l’absence de direction', () => {
    for (const direction of ['left', 'right', 'ahead', 'up', 'down', 'back', null]) {
      const out = writeScheduleCommands(schedule([line({ direction })]), {
        ...WRITE, lineIds: [WRITE.lineIds[0] ?? ''],
      });
      expect(out.ok, String(direction)).toBe(true);
    }
  });
});

describe('W9 — l’écartement est tracé, jamais silencieux', () => {
  const EXCLUSION: Exclusion = {
    cap: 4,
    ruleRef: 'WAYFIND.MAX_DESTINATIONS',
    excludedPriority: 7,
    lastKeptPriority: 3,
  };

  it('écrit quand même la ligne écartée, avec son motif', () => {
    const excluded = new Map([['sup-1#0#1', EXCLUSION]]);
    const out = writeScheduleCommands(TWO, WRITE, excluded);
    if (!out.ok) throw new Error('refus inattendu');

    expect(out.value[1]?.after?.['excluded']).toBe(false);
    expect(out.value[2]?.after?.['excluded']).toBe(true);

    const reason: unknown = JSON.parse(String(out.value[2]?.after?.['exclusion_reason']));
    expect(reason).toEqual({
      cap: 4,
      rule_ref: 'WAYFIND.MAX_DESTINATIONS',
      excluded_priority: 7,
      last_kept_priority: 3,
    });
  });

  it('laisse le motif vide quand rien n’est écarté', () => {
    const out = writeScheduleCommands(TWO, WRITE);
    if (!out.ok) throw new Error('refus inattendu');
    expect(out.value[1]?.after?.['exclusion_reason']).toBeNull();
  });
});
