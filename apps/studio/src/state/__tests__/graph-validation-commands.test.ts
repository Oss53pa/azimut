import { describe, it, expect } from 'vitest';
import type { Finding } from '@azimut/core-model';
import { computeGraphHash } from '@azimut/engine-graph';
import {
  graphIsValidated, writeGraphValidation,
} from '../graph-validation-commands.js';
import type { ValidationRecord } from '../graph-validation-commands.js';
import { EMPTY_SESSION, applyToSession } from '../session-store.js';
import type { SessionState } from '../session-store.js';
import { readSessionGraph } from '../session-graph.js';
import { graphCommands } from '../graph-commands.js';

/**
 * A5.3 et M02.W11 — l'enregistrement d'un passage de validation, et ce qu'il
 * vaut.
 *
 * Le point qui compte : une validation ne vaut que pour le graphe dont elle
 * porte l'empreinte. C'est ce qui fait qu'un graphe modifié après une
 * validation réussie redevient non validé, sans qu'on ait à supprimer quoi que
 * ce soit.
 */

const ORG = 'org-1';
const SITE = 'site-1';
const STAMP = '2026-09-22T10:00:00.000Z';

function blocking(code: string): Finding {
  return { code, severity: 'blocking', entity: null, params: {}, ruleRef: null };
}

function warning(code: string): Finding {
  return { code, severity: 'warning', entity: null, params: {}, ruleRef: null };
}

function commandOf(findings: readonly Finding[]) {
  const out = writeGraphValidation(findings, {
    orgId: ORG, siteId: SITE, id: 'gv-1', timestamp: STAMP, graphHash: 'sha256:abc',
  });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.value;
}

describe('A5.3 — la commande d’enregistrement d’un passage', () => {
  it('écrit le passage avec son empreinte et son horodatage', () => {
    const command = commandOf([]);
    expect(command.table).toBe('graph_validation');
    expect(command.operation).toBe('create');
    expect(command.module).toBe('01-socle');
    expect(command.after?.['graph_hash']).toBe('sha256:abc');
    expect(command.after?.['ran_at']).toBe(STAMP);
  });

  /**
   * La contrainte de base lie `passed` à `blocking_count`. La commande la
   * respecte à la source plutôt que de laisser la base la refuser : un refus
   * de contrainte dirait « ligne invalide » là où il faut dire « ce passage
   * n'est pas passé ».
   */
  it('un passage sans anomalie bloquante est passé', () => {
    const command = commandOf([warning('GRAPH.DEAD_END_UNJUSTIFIED')]);
    expect(command.after?.['passed']).toBe(true);
    expect(command.after?.['blocking_count']).toBe(0);
    expect(command.after?.['warning_count']).toBe(1);
  });

  it('un passage avec une anomalie bloquante n’est pas passé', () => {
    const command = commandOf([blocking('GRAPH.NODE_ORPHAN'), warning('X.Y')]);
    expect(command.after?.['passed']).toBe(false);
    expect(command.after?.['blocking_count']).toBe(1);
    expect(command.after?.['warning_count']).toBe(1);
  });

  it('les anomalies relevées sont conservées avec le passage', () => {
    const command = commandOf([blocking('GRAPH.NODE_ORPHAN')]);
    const stored: unknown = JSON.parse(String(command.after?.['findings']));
    expect(Array.isArray(stored)).toBe(true);
    expect((stored as Finding[])[0]?.code).toBe('GRAPH.NODE_ORPHAN');
  });

  it('refuse une empreinte vide : un passage sans graphe ne vaut rien', () => {
    const out = writeGraphValidation([], {
      orgId: ORG, siteId: SITE, id: 'gv-1', timestamp: STAMP, graphHash: '  ',
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings[0]?.code).toBe('EDIT.COMMAND_SHAPE_INVALID');
  });

  it('refuse un horodatage absent, que la commande ne peut pas suppléer', () => {
    const out = writeGraphValidation([], {
      orgId: ORG, siteId: SITE, id: 'gv-1', timestamp: '', graphHash: 'sha256:abc',
    });
    expect(out.ok).toBe(false);
  });
});

describe('M02.W11 — une validation ne vaut que pour son graphe', () => {
  const record = (over: Partial<ValidationRecord> = {}): ValidationRecord => ({
    graphHash: 'sha256:abc', ranAt: STAMP, passed: true, ...over,
  });

  it('sans aucun passage, le graphe n’est pas validé', () => {
    expect(graphIsValidated([], 'sha256:abc')).toBe(false);
  });

  it('un passage réussi sur le graphe courant vaut validation', () => {
    expect(graphIsValidated([record()], 'sha256:abc')).toBe(true);
  });

  /** Le cœur de la règle : le graphe a changé depuis. */
  it('un passage réussi sur un autre graphe ne vaut rien', () => {
    expect(graphIsValidated([record()], 'sha256:def')).toBe(false);
  });

  it('un passage échoué ne vaut rien, même sur le graphe courant', () => {
    expect(graphIsValidated([record({ passed: false })], 'sha256:abc')).toBe(false);
  });

  /**
   * « Le **dernier** enregistrement. » Un passage réussi plus ancien ne
   * rattrape pas un échec récent, sinon il suffirait de valider une fois pour
   * rester validé à jamais.
   */
  it('seul le dernier passage compte', () => {
    const records = [
      record({ ranAt: '2026-09-22T08:00:00.000Z', passed: true }),
      record({ ranAt: '2026-09-22T09:00:00.000Z', passed: false }),
    ];
    expect(graphIsValidated(records, 'sha256:abc')).toBe(false);
    expect(graphIsValidated([...records].reverse(), 'sha256:abc')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D7.2 — l'empreinte, relue depuis le magasin
// ---------------------------------------------------------------------------

describe('D7.2 — l’empreinte du graphe de la session', () => {
  function store(nodes: readonly { id: string; x: number; y: number }[]): SessionState {
    const out = graphCommands(
      nodes.map(n => ({
        id: n.id,
        node: { kind: 'junction' as const, position: { x_m: n.x, y_m: n.y }, label: n.id },
      })),
      [],
      [],
      { orgId: ORG, levelId: 'lvl-1', timestamp: STAMP },
      'geste-1',
    );
    if (!out.ok) throw new Error(JSON.stringify(out.findings));
    return out.value.reduce(applyToSession, EMPTY_SESSION);
  }

  it('se calcule sur le graphe relu, et non sur des lignes brutes', () => {
    const graph = readSessionGraph(store([{ id: 'n-1', x: 1, y: 2 }]));
    expect(graph.nodes).toHaveLength(1);
    expect(graph.unreadable).toEqual([]);
    expect(computeGraphHash(graph)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('deux calculs sur le même graphe donnent la même empreinte', () => {
    const first = readSessionGraph(store([{ id: 'n-1', x: 1, y: 2 }]));
    const second = readSessionGraph(store([{ id: 'n-1', x: 1, y: 2 }]));
    expect(computeGraphHash(first)).toBe(computeGraphHash(second));
  });

  it('déplacer un nœud change l’empreinte, donc périme la validation', () => {
    const before = readSessionGraph(store([{ id: 'n-1', x: 1, y: 2 }]));
    const after = readSessionGraph(store([{ id: 'n-1', x: 1, y: 3 }]));
    expect(computeGraphHash(before)).not.toBe(computeGraphHash(after));
  });

  it('l’ordre d’écriture ne change pas l’empreinte', () => {
    const forward = readSessionGraph(store([
      { id: 'n-1', x: 1, y: 2 }, { id: 'n-2', x: 3, y: 4 },
    ]));
    const backward = readSessionGraph(store([
      { id: 'n-2', x: 3, y: 4 }, { id: 'n-1', x: 1, y: 2 },
    ]));
    expect(computeGraphHash(forward)).toBe(computeGraphHash(backward));
  });

  it('une ligne illisible est comptée, jamais devinée', () => {
    const state = store([{ id: 'n-1', x: 1, y: 2 }]);
    const broken: SessionState = {
      ...state,
      rows: state.rows.map(row => ({ ...row, values: { ...row.values, position: 'x' } })),
    };
    const graph = readSessionGraph(broken);
    expect(graph.nodes).toEqual([]);
    expect(graph.unreadable).toEqual(['n-1']);
  });
});
