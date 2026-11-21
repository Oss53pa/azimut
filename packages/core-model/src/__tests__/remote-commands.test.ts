import { describe, it, expect } from 'vitest';
import { applyRemoteCommand, emptyRowStore, rowOf } from '../remote-commands.js';
import type { RemoteApplication, RowStore } from '../remote-commands.js';
import { buildCommand, inverseCommand } from '../site-commands.js';
import type { CommandDraft, EntityCommand } from '../site-commands.js';
import { parseCommand, serializeCommand } from '../command-wire.js';

const T = '2026-11-21T10:00:00.000Z';
const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER = 'bbbbbbbb-0000-0000-0000-000000000002';

function cmd(over: Partial<CommandDraft>): EntityCommand {
  const out = buildCommand({
    operation: 'create',
    module: '01-socle',
    table: 'site',
    id: 'site-1',
    org_id: ORG,
    timestamp: T,
    ...over,
  });
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  return out.value;
}

const create = cmd({ after: { id: 'site-1', name: 'Nord', floors: 2 } });
const rename = cmd({
  operation: 'update', before: { name: 'Nord' }, after: { name: 'Nord-Est' },
});

function apply(store: RowStore, command: EntityCommand): RemoteApplication {
  const out = applyRemoteCommand(store, command);
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  return out.value;
}

function applyAll(store: RowStore, commands: readonly EntityCommand[]): RowStore {
  return commands.reduce((s, c) => {
    const r = apply(s, c);
    if (r.kind !== 'applied') throw new Error(`conflit : ${r.reason}`);
    return r.store;
  }, store);
}

/** Une forme comparable d'un état, indépendante des `Map`. */
function snapshot(store: RowStore): unknown {
  return [...store.tables].map(([t, rows]) => [t, [...rows]]);
}

describe('S6.3 — application d’une commande reçue', () => {
  it('crée, modifie puis supprime une ligne', () => {
    const created = applyAll(emptyRowStore(ORG), [create]);
    expect(rowOf(created, 'site', 'site-1')).toEqual({ id: 'site-1', name: 'Nord', floors: 2 });

    const renamed = applyAll(created, [rename]);
    expect(rowOf(renamed, 'site', 'site-1')).toEqual({ id: 'site-1', name: 'Nord-Est', floors: 2 });

    const removed = applyAll(renamed, [cmd({ operation: 'delete', before: { name: 'Nord-Est' } })]);
    expect(rowOf(removed, 'site', 'site-1')).toBeNull();
  });

  it('ne modifie jamais l’état reçu', () => {
    const start = applyAll(emptyRowStore(ORG), [create]);
    const before = snapshot(start);
    apply(start, rename);
    expect(snapshot(start)).toEqual(before);
  });

  it('revient à l’état de départ par la commande inverse', () => {
    const start = applyAll(emptyRowStore(ORG), [create]);
    const back = applyAll(start, [rename, inverseCommand(rename, T)]);
    expect(snapshot(back)).toEqual(snapshot(start));
  });

  it('applique une commande relue comme la commande d’origine (S-19)', () => {
    const written = serializeCommand(create);
    if (!written.ok) throw new Error('écriture');
    const read = parseCommand(written.value);
    if (!read.ok) throw new Error('relecture');
    expect(snapshot(applyAll(emptyRowStore(ORG), [read.value])))
      .toEqual(snapshot(applyAll(emptyRowStore(ORG), [create])));
  });

  it('traite un identifiant __proto__ comme une clé ordinaire', () => {
    const odd = cmd({ id: '__proto__', after: { name: 'x' } });
    const store = applyAll(emptyRowStore(ORG), [odd]);
    expect(rowOf(store, 'site', '__proto__')).toEqual({ name: 'x' });
    expect(({} as Record<string, unknown>)['name']).toBeUndefined();
  });
});

/**
 * L4.4 — « Les conflits réels sont arbitrés par l'utilisateur avec les deux
 * versions présentées. » Le moteur constate, il ne fusionne pas.
 */
describe('S6.3 — conflit constaté, jamais fusionné', () => {
  it('constate la création d’une ligne qui existe déjà', () => {
    const start = applyAll(emptyRowStore(ORG), [create]);
    const r = apply(start, create);
    expect(r.kind === 'conflict' && r.reason).toBe('row_exists');
    expect(r.store).toBe(start);
  });

  it('constate la modification d’une ligne supprimée ailleurs', () => {
    const r = apply(emptyRowStore(ORG), rename);
    expect(r.kind === 'conflict' && r.reason).toBe('row_missing');
  });

  it('constate une modification concurrente et présente les deux versions', () => {
    const start = applyAll(emptyRowStore(ORG), [create]);
    const otherRename = cmd({
      operation: 'update', before: { name: 'Nord' }, after: { name: 'Nord-Ouest' },
    });
    const afterFirst = applyAll(start, [rename]);
    const r = apply(afterFirst, otherRename);

    if (r.kind !== 'conflict') throw new Error('appliqué');
    expect(r.reason).toBe('row_changed');
    expect(r.columns).toEqual(['name']);
    expect(r.current).toEqual({ id: 'site-1', name: 'Nord-Est', floors: 2 });
    expect(r.command).toBe(otherRename);
    expect(snapshot(r.store)).toEqual(snapshot(afterFirst));
  });

  it('applique deux modifications de colonnes disjointes', () => {
    const start = applyAll(emptyRowStore(ORG), [create]);
    const floors = cmd({ operation: 'update', before: { floors: 2 }, after: { floors: 3 } });
    const end = applyAll(start, [rename, floors]);
    expect(rowOf(end, 'site', 'site-1')).toEqual({ id: 'site-1', name: 'Nord-Est', floors: 3 });
  });

  it('constate une colonne attendue et absente de la ligne', () => {
    const start = applyAll(emptyRowStore(ORG), [create]);
    const r = apply(start, cmd({ operation: 'update', before: { area: null }, after: { area: 4 } }));
    expect(r.kind === 'conflict' && r.columns).toEqual(['area']);
  });

  it('constate la suppression d’une ligne modifiée ailleurs', () => {
    const start = applyAll(emptyRowStore(ORG), [create, rename]);
    const r = apply(start, cmd({ operation: 'delete', before: { name: 'Nord' } }));
    expect(r.kind === 'conflict' && r.reason).toBe('row_changed');
  });
});

describe('S6.3 — cloisonnement et déterminisme', () => {
  it('refuse une commande d’une autre organisation (A6.1)', () => {
    const out = applyRemoteCommand(emptyRowStore(OTHER), create);
    expect(!out.ok && out.findings.map(f => f.code)).toEqual(['EDIT.WRITE_REFUSED']);
    expect(JSON.stringify(out)).not.toContain('Nord');
  });

  it('deux postes qui reçoivent la même suite obtiennent le même état (A9)', () => {
    const suite = [
      create,
      cmd({ table: 'level', id: 'lvl-1', after: { id: 'lvl-1', ordinal: 0 } }),
      rename,
      cmd({ operation: 'update', table: 'level', id: 'lvl-1', before: { ordinal: 0 }, after: { ordinal: 1 } }),
    ];
    const a = applyAll(emptyRowStore(ORG), suite);
    const b = applyAll(emptyRowStore(ORG), suite);
    expect(snapshot(a)).toEqual(snapshot(b));
  });
});
