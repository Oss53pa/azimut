import { describe, it, expect } from 'vitest';
import {
  EMPTY_SESSION, applyToSession, rowsOf, countOf, storageKey,
  saveSession, readSession, clearSession, writeToSession, flushQueue,
  footprintVertices, resumeDecision, markOpenInTab, isOpenInTab, highestLocalRank,
} from '../session-store.js';
import type { SessionState } from '../session-store.js';
import { buildCommand } from '@azimut/core-model';
import type { EntityCommand, Outcome } from '@azimut/core-model';

const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';
const T = '2026-09-22T10:00:00.000Z';

function cmd(
  table: string, id: string,
  after: Record<string, string> | null = { id, org_id: ORG },
  operation: 'create' | 'update' | 'delete' = 'create',
): EntityCommand {
  const out = buildCommand({
    operation, module: '01-socle', table, id, org_id: ORG,
    ...(operation === 'delete'
      ? { before: { id, org_id: ORG }, after: null }
      : operation === 'update'
        ? { before: { id }, after: after ?? { id } }
        : { after: after ?? { id } }),
    timestamp: T, groupKey: 'geste',
  });
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  return out.value;
}

const ACCEPTS = async (): Promise<Outcome<unknown>> => ({ ok: true, value: null, warnings: [] });
const REFUSES = async (): Promise<Outcome<unknown>> => ({
  ok: false,
  findings: [{ code: 'EDIT.WRITE_REFUSED', severity: 'blocking', entity: null, params: {}, ruleRef: 'A6.1' }],
});

/** Un stockage local en mémoire, suffisant pour éprouver E5.4. */
function memoryStorage(): Storage & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    length: 0,
    clear: () => { map.clear(); },
    getItem: (k: string) => map.get(k) ?? null,
    key: () => null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  } as Storage & { readonly map: Map<string, string> };
}

describe('magasin de session — l’état local du parcours', () => {
  it('ajoute une ligne à la création', () => {
    const state = applyToSession(EMPTY_SESSION, cmd('site', 's1'));
    expect(countOf(state, 'site')).toBe(1);
  });

  it('fusionne les valeurs à la mise à jour', () => {
    let state = applyToSession(EMPTY_SESSION, cmd('site', 's1', { id: 's1', org_id: ORG }));
    state = applyToSession(state, cmd('site', 's1', { id: 's1', name: 'Gare' }, 'update'));
    expect(rowsOf(state, 'site')[0]?.values).toMatchObject({ org_id: ORG, name: 'Gare' });
  });

  it('retire la ligne à la suppression', () => {
    let state = applyToSession(EMPTY_SESSION, cmd('site', 's1'));
    state = applyToSession(state, cmd('site', 's1', null, 'delete'));
    expect(countOf(state, 'site')).toBe(0);
  });

  it('garde l’ordre d’écriture', () => {
    let state = EMPTY_SESSION;
    for (const id of ['a', 'b', 'c']) state = applyToSession(state, cmd('node', id));
    expect(rowsOf(state, 'node').map(r => r.id)).toEqual(['a', 'b', 'c']);
  });
});

/**
 * E5.4 — « Sauvegarde locale à chaque commande validée, en stockage local du
 * navigateur, distincte de la synchronisation serveur. »
 */
describe('E5.4 — sauvegarde locale', () => {
  it('une clé par site : deux sites ne se mélangent pas', () => {
    expect(storageKey('s1')).not.toBe(storageKey('s2'));
  });

  it('sauvegarde et relit l’état', () => {
    const storage = memoryStorage();
    const state = applyToSession(EMPTY_SESSION, cmd('site', 's1'));
    expect(saveSession('s1', state, storage)).toBe(true);
    expect(readSession('s1', storage)?.rows).toEqual(state.rows);
  });

  it('rend null quand il n’y a rien à reprendre', () => {
    expect(readSession('s1', memoryStorage())).toBeNull();
  });

  /**
   * Un état local illisible vaut une absence d'état local : proposer une
   * reprise depuis des octets qu'on ne comprend pas serait pire que rien.
   */
  it('rend null plutôt que de reprendre un état illisible', () => {
    const storage = memoryStorage();
    storage.setItem(storageKey('s1'), '{ceci n’est pas du JSON');
    expect(readSession('s1', storage)).toBeNull();
  });

  /**
   * Un refus du stockage — navigation privée, quota — fait perdre la reprise
   * après incident, jamais la session en cours.
   */
  it('n’interrompt pas le travail quand le stockage refuse', () => {
    expect(saveSession('s1', EMPTY_SESSION, null)).toBe(false);
    expect(() => { clearSession('s1', null); }).not.toThrow();
  });

  /** « Aucune fusion silencieuse » : la relecture propose, elle ne restaure pas. */
  it('la relecture ne modifie pas l’état courant', () => {
    const storage = memoryStorage();
    saveSession('s1', applyToSession(EMPTY_SESSION, cmd('site', 's1')), storage);
    const courant = EMPTY_SESSION;
    readSession('s1', storage);
    expect(courant).toEqual(EMPTY_SESSION);
  });
});

/**
 * M8 (partie M) critère 3 — « Le même parcours est réalisable hors ligne, avec
 * synchronisation au retour du réseau. »
 */
describe('M8 (partie M) critère 3 — hors ligne et synchronisation', () => {
  const offline: SessionState = { ...EMPTY_SESSION, online: false };

  it('hors ligne, l’état local avance et les commandes entrent en file', async () => {
    const state = await writeToSession(offline, [cmd('site', 's1')], ACCEPTS);
    expect(countOf(state, 'site')).toBe(1);
    expect(state.queued.length).toBe(1);
  });

  it('en ligne, rien n’entre en file', async () => {
    const state = await writeToSession(EMPTY_SESSION, [cmd('site', 's1')], ACCEPTS);
    expect(state.queued).toEqual([]);
  });

  /**
   * Une coupure au milieu du parcours ne doit pas perdre le travail : un envoi
   * qui échoue met la commande en file, comme si l'on était hors ligne.
   */
  it('un envoi refusé met la commande en file', async () => {
    const state = await writeToSession(EMPTY_SESSION, [cmd('site', 's1')], REFUSES);
    expect(state.queued.length).toBe(1);
    expect(countOf(state, 'site')).toBe(1);
  });

  it('la synchronisation vide la file et repasse en ligne', async () => {
    const written = await writeToSession(offline, [cmd('site', 's1'), cmd('level', 'l1')], ACCEPTS);
    const { state, flushed } = await flushQueue(written, ACCEPTS);
    expect(flushed).toBe(2);
    expect(state.queued).toEqual([]);
    expect(state.online).toBe(true);
  });

  /**
   * Tout ou rien : une file à moitié partie laisserait le dépôt dans un état
   * que personne ne sait décrire.
   */
  it('une synchronisation refusée laisse la file entière', async () => {
    const written = await writeToSession(offline, [cmd('site', 's1'), cmd('level', 'l1')], ACCEPTS);
    const { state, flushed } = await flushQueue(written, REFUSES);
    expect(flushed).toBe(0);
    expect(state.queued.length).toBe(2);
  });

  it('une file vide se synchronise sans rien envoyer', async () => {
    const { flushed } = await flushQueue(EMPTY_SESSION, REFUSES);
    expect(flushed).toBe(0);
  });
});

describe('relecture de la géométrie', () => {
  it('relit les sommets d’une empreinte', () => {
    const vertices = [{ x_m: 0, y_m: 0 }, { x_m: 3, y_m: 0 }, { x_m: 3, y_m: 4 }];
    const state = applyToSession(EMPTY_SESSION, cmd('footprint', 'f1', {
      id: 'f1', org_id: ORG, geometry: JSON.stringify({ vertices }),
    }));
    expect(footprintVertices(rowsOf(state, 'footprint')[0] as never)).toEqual(vertices);
  });

  it('rend une liste vide plutôt que d’échouer sur une géométrie illisible', () => {
    const state = applyToSession(EMPTY_SESSION, cmd('footprint', 'f1', {
      id: 'f1', org_id: ORG, geometry: 'pas du JSON',
    }));
    expect(footprintVertices(rowsOf(state, 'footprint')[0] as never)).toEqual([]);
  });
});

describe('E5.4 — la reprise, et ce qui la distingue d’une navigation', () => {
  const site = 'site-reprise';

  function saved(rows: number): SessionState {
    return {
      rows: Array.from({ length: rows }, (_, i) => ({
        table: 'node', id: `n-${String(i)}`, values: {},
      })),
      queued: [],
      online: true,
    };
  }

  it('ne propose rien quand il n’y a pas d’état local', () => {
    expect(resumeDecision(null, false).kind).toBe('rien');
  });

  it('ne propose rien quand l’état local est vide', () => {
    expect(resumeDecision(EMPTY_SESSION, false).kind).toBe('rien');
  });

  it('poursuit sans rien demander quand l’onglet travaille déjà sur ce site', () => {
    const decision = resumeDecision(saved(3), true);
    expect(decision.kind).toBe('poursuivre');
    if (decision.kind === 'poursuivre') expect(decision.state.rows).toHaveLength(3);
  });

  it('propose la reprise quand le travail vient d’ailleurs', () => {
    const decision = resumeDecision(saved(2), false);
    expect(decision.kind).toBe('proposer');
    if (decision.kind === 'proposer') expect(decision.state.rows).toHaveLength(2);
  });

  it('la marque d’onglet se pose, se relit, et ne vaut que pour son site', () => {
    const tab = memoryStorage();
    expect(isOpenInTab(site, tab)).toBe(false);
    markOpenInTab(site, tab);
    expect(isOpenInTab(site, tab)).toBe(true);
    expect(isOpenInTab('autre-site', tab)).toBe(false);
  });

  it('sans stockage de session, la reprise est proposée plutôt que supposée', () => {
    // Un onglet qui ne peut pas se marquer n'est jamais réputé ouvert : la
    // question est posée, ce qui est le comportement sûr.
    expect(isOpenInTab(site, null)).toBe(false);
  });

  it('le rang du dernier identifiant local est repris, sans quoi la suite réécrit', () => {
    expect(highestLocalRank([])).toBe(0);
    expect(highestLocalRank([
      { table: 'node', id: '00000000-0000-4000-8000-000000000001', values: {} },
      { table: 'edge', id: '00000000-0000-4000-8000-00000000000b', values: {} },
      { table: 'node', id: 'un-identifiant-du-depot', values: {} },
    ])).toBe(11);
  });
});
