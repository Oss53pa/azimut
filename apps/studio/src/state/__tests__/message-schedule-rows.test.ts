import { describe, it, expect } from 'vitest';
import type { Finding } from '@azimut/core-model';
import type { MessageLine, MessageSchedule } from '@azimut/engine-graph';
import {
  NO_FILTERS, applyFilters, buildRows, foldForSearch, groupRows, stableLineId,
} from '../message-schedule-rows.js';
import type { Exclusion } from '../message-schedule-commands.js';

/**
 * R5, R6, R9 et R10 (partie R) — les lignes telles que l'écran les présente.
 *
 * Deux critères d'acceptation de R18 sont éprouvés ici : le quatrième,
 * « un filtre actif affiche le nombre de lignes qu'il masque », et la règle de
 * R9 qui veut qu'une ligne écartée reste visible par son filtre plutôt que
 * disparaisse.
 */

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

function schedule(lines: readonly MessageLine[]): MessageSchedule {
  return {
    site_id: 'site-1',
    version: 3,
    state: 'draft',
    generated_at: '2026-04-01T00:00:00.000Z',
    inputs_hash: 'abcd1234ef',
    lines,
  };
}

const CODES = new Map([['sup-1', 'D-042'], ['sup-2', 'D-043']]);

const EXCLUSION: Exclusion = {
  cap: 5, ruleRef: 'M02.W9', excludedPriority: 9, lastKeptPriority: 4,
};

function blocking(lineId: string): Finding {
  return {
    code: 'WAYFIND.CONTINUITY_BROKEN',
    severity: 'blocking',
    entity: { kind: 'message_line', id: lineId },
    params: {},
    ruleRef: null,
  };
}

// ---------------------------------------------------------------------------
// R5 (partie R) — l'identifiant stable
// ---------------------------------------------------------------------------

describe('R5 (partie R) — l’identifiant stable d’une ligne', () => {
  it('se forme du code de support, de la face et du bloc', () => {
    expect(stableLineId('D-042', 1, 3)).toBe('D-042/F1/B3');
  });

  it('imprime les index tels que le modèle les stocke', () => {
    // R5 (partie R) donne « D-042/F1/B3 » en exemple, jamais une origine de numérotation.
    // Décaler de un ferait porter à l'identifiant une valeur que la donnée n'a
    // pas, et la comparaison de R11 repose sur cet identifiant.
    expect(stableLineId('D-042', 0, 0)).toBe('D-042/F0/B0');
  });

  it('n’est pas formable sans code de support', () => {
    expect(stableLineId(null, 0, 0)).toBeNull();
    expect(stableLineId('   ', 0, 0)).toBeNull();
  });

  it('la ligne porte alors un identifiant nul, que l’écran marque', () => {
    const rows = buildRows({
      schedule: schedule([line({ support_id: 'sup-inconnu' })]),
      supportCodes: CODES,
      exclusions: new Map(),
      findings: [],
    });
    expect(rows[0]?.stableId).toBeNull();
    expect(rows[0]?.supportCode).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// R10 — l'état d'une ligne
// ---------------------------------------------------------------------------

describe('R10 (partie R) — l’état d’une ligne', () => {
  function stateOf(over: Partial<MessageLine>, extras: {
    findings?: readonly Finding[];
    exclusions?: ReadonlyMap<string, Exclusion>;
  } = {}): string | undefined {
    const rows = buildRows({
      schedule: schedule([line(over)]),
      supportCodes: CODES,
      exclusions: extras.exclusions ?? new Map(),
      findings: extras.findings ?? [],
    });
    return rows[0]?.state;
  }

  it('une ligne sans rien à signaler est à jour', () => {
    expect(stateOf({})).toBe('current');
  });

  it('une ligne périmée le dit', () => {
    expect(stateOf({ stale: true })).toBe('stale');
  });

  it('une anomalie bloquante prime sur la péremption', () => {
    expect(stateOf({ stale: true }, { findings: [blocking('sup-1#0#0')] })).toBe('blocking');
  });

  it('l’écartement prime sur tout : une ligne écartée n’est jamais composée', () => {
    expect(stateOf({ stale: true }, {
      findings: [blocking('sup-1#0#0')],
      exclusions: new Map([['sup-1#0#0', EXCLUSION]]),
    })).toBe('excluded');
  });

  it('les anomalies d’une autre ligne ne la touchent pas', () => {
    expect(stateOf({}, { findings: [blocking('sup-9#0#0')] })).toBe('current');
  });
});

// ---------------------------------------------------------------------------
// R6 (partie R) — filtres, recherche, lignes masquées
// ---------------------------------------------------------------------------

describe('R6 (partie R) — filtres et recherche', () => {
  const rows = buildRows({
    schedule: schedule([
      line({ id: 'sup-1#0#0' }),
      line({ id: 'sup-1#0#1', block_index: 1, direction: 'right', stale: true }),
      line({
        id: 'sup-2#0#0', support_id: 'sup-2', decision_point_id: 'n-parvis',
        entries: [{
          destination_id: 'dest-2',
          text: { fr: 'Café Étoilé', en: 'Starred café' },
          direction: null, distance_m: null,
        }],
      }),
    ]),
    supportCodes: CODES,
    exclusions: new Map([['sup-2#0#0', EXCLUSION]]),
    findings: [],
  });

  it('les lignes écartées sont masquées par défaut', () => {
    const out = applyFilters(rows, NO_FILTERS);
    expect(out.rows).toHaveLength(2);
  });

  /**
   * R3 (partie R) : la barre d'état compte « 3 écartées » que le filtre les montre ou
   * non. Le compte dit ce que le tableau porte, pas ce que la vue affiche —
   * sans quoi masquer les écartées les ferait disparaître du compte aussi,
   * et l'écran cesserait de dire ce qui n'a pas trouvé de place.
   */
  it('le compte des écartées ne dépend pas du filtre qui les masque', () => {
    expect(applyFilters(rows, NO_FILTERS).excluded).toBe(1);
    expect(applyFilters(rows, { ...NO_FILTERS, showExcluded: true }).excluded).toBe(1);
  });

  it('le filtre « Écartées » les fait revenir, et elles sont comptées', () => {
    const out = applyFilters(rows, { ...NO_FILTERS, showExcluded: true });
    expect(out.rows).toHaveLength(3);
  });

  /** Critère 4 de R18 : « Un filtre actif affiche le nombre de lignes qu'il masque. » */
  it('un filtre actif donne le nombre exact de lignes masquées', () => {
    const out = applyFilters(rows, { ...NO_FILTERS, staleOnly: true });
    expect(out.rows).toHaveLength(1);
    expect(out.hidden).toBe(2);
  });

  it('le filtre de direction retient les seules lignes qui la portent', () => {
    const out = applyFilters(rows, { ...NO_FILTERS, directions: ['right'] });
    expect(out.rows.map(r => r.line.id)).toEqual(['sup-1#0#1']);
  });

  it('le filtre de point de décision retient les seules lignes qui le citent', () => {
    const out = applyFilters(rows, {
      ...NO_FILTERS, decisionPointIds: ['n-parvis'], showExcluded: true,
    });
    expect(out.rows.map(r => r.line.id)).toEqual(['sup-2#0#0']);
  });

  it('la recherche ignore les accents et la casse', () => {
    expect(foldForSearch('Café Étoilé')).toBe('cafe etoile');
    const out = applyFilters(rows, {
      ...NO_FILTERS, search: 'ETOILE', showExcluded: true,
    });
    expect(out.rows.map(r => r.line.id)).toEqual(['sup-2#0#0']);
  });

  it('la recherche porte aussi sur les codes et les points de décision', () => {
    const out = applyFilters(rows, { ...NO_FILTERS, search: 'd-042' });
    expect(out.rows).toHaveLength(2);
  });

  it('aucun filtre ne masque rien', () => {
    expect(applyFilters(rows, { ...NO_FILTERS, showExcluded: true }).hidden).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R6.1 (partie R) — regroupement
// ---------------------------------------------------------------------------

describe('R6.1 (partie R) — regroupement', () => {
  const rows = buildRows({
    schedule: schedule([
      line({ id: 'sup-1#0#0' }),
      line({ id: 'sup-2#0#0', support_id: 'sup-2', decision_point_id: 'n-parvis' }),
    ]),
    supportCodes: CODES,
    exclusions: new Map(),
    findings: [],
  });

  const EMPTY = { zoneOfSupport: new Map(), levelOfSupport: new Map() };

  it('groupe par support, et l’en-tête porte son code', () => {
    const groups = groupRows(rows, 'support', EMPTY);
    expect(groups.map(g => g.heading)).toEqual(['D-042', 'D-043']);
  });

  /** M02.W5 : c'est ce regroupement qui sert à vérifier la continuité. */
  it('groupe par point de décision', () => {
    const groups = groupRows(rows, 'decision_point', EMPTY);
    expect(groups.map(g => g.heading)).toEqual(['n-hall', 'n-parvis']);
  });

  it('un rattachement non déclaré donne un en-tête nul, jamais vide', () => {
    const groups = groupRows(rows, 'zone', EMPTY);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.heading).toBeNull();
    expect(groups[0]?.rows).toHaveLength(2);
  });

  it('aucune ligne ne se perd au regroupement', () => {
    for (const grouping of ['support', 'zone', 'level', 'decision_point'] as const) {
      const total = groupRows(rows, grouping, EMPTY)
        .reduce((n, group) => n + group.rows.length, 0);
      expect(total, grouping).toBe(rows.length);
    }
  });
});
