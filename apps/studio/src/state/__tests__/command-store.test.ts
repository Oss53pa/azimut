import { describe, it, expect } from 'vitest';
import { buildCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import {
  EMPTY_STORE, UNDO_DEPTH, dispatch, undo, redo, afterSync, canUndo, canRedo,
} from '../command-store.js';
import type { StoreState, CommandSink } from '../command-store.js';

const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';

function cmd(id: string, group: string | null = null, t = '2026-09-21T10:00:00.000Z'): EntityCommand {
  const out = buildCommand({
    operation: 'create', module: '01-socle', table: 'site', id, org_id: ORG,
    after: { id, org_id: ORG, name: id, country_code: 'FR' },
    timestamp: t, groupKey: group,
  });
  if (!out.ok) throw new Error('commande invalide');
  return out.value;
}

/** Un émetteur qui accepte tout et retient ce qu'on lui a confié. */
function accepting(): { sink: CommandSink; seen: EntityCommand[][] } {
  const seen: EntityCommand[][] = [];
  const sink: CommandSink = async (commands) => {
    seen.push([...commands]);
    return { ok: true, value: null, warnings: [] };
  };
  return { sink, seen };
}

/** Un émetteur qui refuse, comme le ferait la base hors de l'organisation. */
const refusing: CommandSink = async () => ({
  ok: false,
  findings: [{
    code: 'EDIT.WRITE_REFUSED', severity: 'blocking', entity: null,
    params: {}, ruleRef: 'A6.1',
  }],
});

async function apply(state: StoreState, sink: CommandSink, cs: EntityCommand[]) {
  return dispatch(state, sink, cs);
}

/**
 * F15 — `state/`, « magasin et commandes, écrit dans le dépôt », et A2 du
 * module 12 : l'atelier n'écrit jamais directement, il passe par les commandes
 * du module propriétaire.
 */
describe('magasin de commandes', () => {
  it('confie les commandes à l’émetteur et les empile', async () => {
    const { sink, seen } = accepting();
    const r = await apply(EMPTY_STORE, sink, [cmd('s1')]);
    expect(r.outcome.ok).toBe(true);
    expect(seen).toEqual([[cmd('s1')]]);
    expect(r.state.undoStack.length).toBe(1);
  });

  /**
   * M7.5 (partie M) — « Un refus de saisie n'efface jamais le travail en
   * cours. » Une
   * commande refusée ne doit pas non plus entrer dans la pile : elle y serait
   * annulable, et son inverse s'écrirait sur une ligne qui n'a pas bougé.
   */
  it('n’empile rien quand l’écriture est refusée', async () => {
    const r = await apply(EMPTY_STORE, refusing, [cmd('s1')]);
    expect(r.outcome.ok).toBe(false);
    expect(r.state).toEqual(EMPTY_STORE);
  });

  it('regroupe les commandes d’un même geste en une seule entrée (E5.2)', async () => {
    const { sink } = accepting();
    const r = await apply(EMPTY_STORE, sink, [cmd('s1', 'geste'), cmd('s2', 'geste')]);
    expect(r.state.undoStack.length).toBe(1);
    expect(r.state.undoStack[0]?.commands.length).toBe(2);
  });

  it('plafonne la pile à la profondeur nommée (E5.2)', async () => {
    const { sink } = accepting();
    let state = EMPTY_STORE;
    for (let i = 0; i < UNDO_DEPTH + 5; i += 1) {
      state = (await apply(state, sink, [cmd(`s${i}`)])).state;
    }
    expect(state.undoStack.length).toBe(UNDO_DEPTH);
    // Ce sont les plus anciennes qui tombent.
    expect(state.undoStack[0]?.commands[0]?.id).toBe('s5');
  });
});

/**
 * E5.1 — « Une commande est réversible. » L'annulation n'est pas un retrait :
 * c'est une écriture inverse, qui passe par le même chemin et le même
 * cloisonnement.
 */
describe('annulation et rétablissement', () => {
  const T2 = '2026-09-21T10:00:05.000Z';

  it('annule en écrivant l’inverse, par le même émetteur', async () => {
    const { sink, seen } = accepting();
    const after = await apply(EMPTY_STORE, sink, [cmd('s1')]);
    const r = await undo(after.state, sink, T2);
    expect(r.outcome.ok).toBe(true);
    expect(seen[1]?.[0]?.operation).toBe('delete');
    expect(seen[1]?.[0]?.timestamp).toBe(T2);
    expect(canUndo(r.state)).toBe(false);
    expect(canRedo(r.state)).toBe(true);
  });

  /**
   * Défaire la dernière commande d'abord est la seule façon de retrouver
   * l'état de départ quand les lignes sont liées.
   */
  it('inverse les commandes d’un geste en ordre inverse', async () => {
    const { sink, seen } = accepting();
    const after = await apply(EMPTY_STORE, sink, [cmd('s1', 'g'), cmd('s2', 'g')]);
    await undo(after.state, sink, T2);
    expect(seen[1]?.map(c => c.id)).toEqual(['s2', 's1']);
  });

  it('une annulation refusée laisse la pile intacte', async () => {
    const { sink } = accepting();
    const after = await apply(EMPTY_STORE, sink, [cmd('s1')]);
    const r = await undo(after.state, refusing, T2);
    expect(r.outcome.ok).toBe(false);
    expect(r.state).toEqual(after.state);
  });

  it('rétablit en réécrivant, avec le nouvel horodatage', async () => {
    const { sink, seen } = accepting();
    const a = await apply(EMPTY_STORE, sink, [cmd('s1')]);
    const b = await undo(a.state, sink, T2);
    const c = await redo(b.state, sink, '2026-09-21T10:00:09.000Z');
    expect(c.outcome.ok).toBe(true);
    expect(seen[2]?.[0]?.operation).toBe('create');
    expect(seen[2]?.[0]?.timestamp).toBe('2026-09-21T10:00:09.000Z');
    expect(canRedo(c.state)).toBe(false);
  });

  it('une écriture neuve rend le rétablissement caduc', async () => {
    const { sink } = accepting();
    const a = await apply(EMPTY_STORE, sink, [cmd('s1')]);
    const b = await undo(a.state, sink, T2);
    expect(canRedo(b.state)).toBe(true);
    const c = await apply(b.state, sink, [cmd('s2')]);
    expect(canRedo(c.state)).toBe(false);
  });

  it('annuler sans rien à annuler ne fait rien et le dit', async () => {
    const { sink } = accepting();
    const r = await undo(EMPTY_STORE, sink, T2);
    expect(r.outcome.ok).toBe(false);
    if (!r.outcome.ok) expect(r.outcome.findings[0]?.code).toBe('EDIT.NOTHING_TO_UNDO');
  });
});

/**
 * E5.3 — « La pile d'annulation est vidée à la synchronisation. Ce qui est
 * synchronisé n'est plus annulable localement. » C'est la règle qui rend
 * tenable la rencontre d'un historique local et d'une fusion par objet.
 *
 * A6 du module 12 la reprend : « La pile d'annulation est vidée à la
 * synchronisation. Revenir sur une modification synchronisée se fait par une
 * commande inverse tracée. »
 */
describe('E5.3 — la synchronisation vide la pile', () => {
  it('vide l’annulation, le rétablissement et les commandes en attente', async () => {
    const { sink } = accepting();
    let state = (await apply(EMPTY_STORE, sink, [cmd('s1')])).state;
    state = (await apply(state, sink, [cmd('s2')])).state;
    state = (await undo(state, sink, '2026-09-21T10:00:05.000Z')).state;
    expect(canUndo(state)).toBe(true);
    expect(canRedo(state)).toBe(true);
    expect(state.pending.length).toBeGreaterThan(0);

    const synced = afterSync(state);
    expect(canUndo(synced)).toBe(false);
    expect(canRedo(synced)).toBe(false);
    expect(synced.pending).toEqual([]);
  });

  it('après synchronisation, il n’y a plus rien à annuler', async () => {
    const { sink } = accepting();
    const state = (await apply(EMPTY_STORE, sink, [cmd('s1')])).state;
    const r = await undo(afterSync(state), sink, '2026-09-21T10:00:05.000Z');
    expect(r.outcome.ok).toBe(false);
    if (!r.outcome.ok) expect(r.outcome.findings[0]?.code).toBe('EDIT.NOTHING_TO_UNDO');
  });
});
