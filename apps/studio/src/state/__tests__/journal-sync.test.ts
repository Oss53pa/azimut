import { describe, it, expect } from 'vitest';
import { buildCommand, serializeCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import { createJournaledSink } from '../journaled-sink.js';
import {
  follow, pollJournal, readJournalSince, recordOwnWrite, startCursor, trackOwnWrites,
} from '../journal-follower.js';
import type { JournalCursor, JournalEntry, ReadOutcome } from '../journal-follower.js';

const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';
const SITE = 'aaaaaaaa-0000-0000-0000-0000000000b1';
const AUTHOR = 'aaaaaaaa-0000-0000-0000-0000000000d1';
const CONFIG = { url: 'https://example.invalid/rest/v1', apiKey: 'clé-de-test', schema: 'azimut' };

function cmd(name: string): EntityCommand {
  const out = buildCommand({
    operation: 'update', module: '01-socle', table: 'site', id: SITE, org_id: ORG,
    before: { name: 'Site' }, after: { name }, timestamp: '2026-11-21T10:00:00.000Z',
  });
  if (!out.ok) throw new Error('commande invalide');
  return out.value;
}

function wire(command: EntityCommand): unknown {
  const out = serializeCommand(command);
  if (!out.ok) throw new Error('écriture');
  return JSON.parse(out.value) as unknown;
}

function responder(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function entry(seq: number, name = `n${String(seq)}`): JournalEntry {
  return { seq, authorId: AUTHOR, command: cmd(name) };
}

describe('S6.2 — émetteur journalisé', () => {
  it('envoie les commandes entières, avec le site et le niveau', async () => {
    const { fetchImpl, calls } = responder(200, 7);
    const sink = createJournaledSink(CONFIG, { siteId: SITE, levelId: null }, fetchImpl);
    const out = await sink([cmd('A'), cmd('B')]);

    expect(out.ok && out.value).toEqual({ lastSeq: 7, count: 2 });
    expect(calls[0]?.url).toBe(`${CONFIG.url}/rpc/apply_journaled_commands`);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      p_site_id: SITE, p_level_id: null, p_commands: [wire(cmd('A')), wire(cmd('B'))],
    });
  });

  it('rend une commande périmée comme un refus de cause 409, sans message de la base', async () => {
    const { fetchImpl } = responder(409, { message: 'commande périmée', details: 'secret' });
    const out = await createJournaledSink(CONFIG, { siteId: SITE, levelId: null }, fetchImpl)([cmd('A')]);
    expect(!out.ok && out.findings[0]?.params['cause']).toBe('409');
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('refuse une réponse qui n’est pas un numéro plausible', async () => {
    for (const body of ['7', 0, 1.5, null]) {
      const { fetchImpl } = responder(200, body);
      const out = await createJournaledSink(CONFIG, { siteId: SITE, levelId: null }, fetchImpl)([cmd('A'), cmd('B')]);
      expect(!out.ok && out.findings[0]?.params['cause']).toBe('response');
    }
  });

  it('refuse le transport coupé', async () => {
    const fetchImpl = (async () => { throw new Error('réseau'); }) as unknown as typeof fetch;
    const out = await createJournaledSink(CONFIG, { siteId: SITE, levelId: null }, fetchImpl)([cmd('A')]);
    expect(!out.ok && out.findings[0]?.params['cause']).toBe('transport');
  });
});

describe('S6.6 — lecture du journal', () => {
  it('demande la suite du site après le curseur, dans l’ordre', async () => {
    const { fetchImpl, calls } = responder(200, []);
    await readJournalSince(CONFIG, SITE, 41, fetchImpl);
    const url = new URL(calls[0]?.url ?? '');
    expect(url.pathname).toBe('/rest/v1/command_journal');
    expect(url.searchParams.get('site_id')).toBe(`eq.${SITE}`);
    expect(url.searchParams.get('seq')).toBe('gt.41');
    expect(url.searchParams.get('order')).toBe('seq.asc');
  });

  it('relit chaque commande sous validation', async () => {
    const { fetchImpl } = responder(200, [{ seq: 1, author_id: AUTHOR, command: wire(cmd('A')) }]);
    const out = await readJournalSince(CONFIG, SITE, 0, fetchImpl);
    expect(out.ok && out.entries).toEqual([{ seq: 1, authorId: AUTHOR, command: cmd('A') }]);
  });

  it('s’arrête sur une commande qui ne se relit pas, et le dit', async () => {
    const forged = { ...(wire(cmd('A')) as object), module: '02-wayfinding' };
    const { fetchImpl } = responder(200, [{ seq: 1, author_id: AUTHOR, command: forged }]);
    const out = await readJournalSince(CONFIG, SITE, 0, fetchImpl);
    expect(!out.ok && out.cause).toBe('command');
    expect(!out.ok && out.findings.map(f => f.code)).toEqual(['EDIT.TABLE_NOT_OWNED']);
  });

  it('refuse une ligne de forme inattendue', async () => {
    for (const row of [{ seq: '1', author_id: AUTHOR, command: {} }, { seq: 1, author_id: 'x', command: {} }]) {
      const { fetchImpl } = responder(200, [row]);
      expect(await readJournalSince(CONFIG, SITE, 0, fetchImpl)).toEqual({ ok: false, cause: 'response', findings: [] });
    }
  });

  it('refuse des arguments qui fabriqueraient une requête', async () => {
    const { fetchImpl, calls } = responder(200, []);
    expect((await readJournalSince(CONFIG, `${SITE}&seq=gt.0`, 0, fetchImpl)).ok).toBe(false);
    expect((await readJournalSince(CONFIG, SITE, -1, fetchImpl)).ok).toBe(false);
    expect(calls.length).toBe(0);
  });
});

describe('S6.6 — le curseur', () => {
  it('rend les entrées suivantes et avance', () => {
    const step = follow(startCursor(SITE), [entry(1), entry(2)]);
    expect(step.received.map(e => e.seq)).toEqual([1, 2]);
    expect(step.cursor.lastSeq).toBe(2);
    expect(step.gap).toBe(false);
  });

  it('n’applique jamais deux fois une entrée relue', () => {
    const first = follow(startCursor(SITE), [entry(1), entry(2)]);
    const again = follow(first.cursor, [entry(1), entry(2), entry(3)]);
    expect(again.received.map(e => e.seq)).toEqual([3]);
  });

  it('avance sur ses propres écritures sans les rendre', () => {
    const cursor = recordOwnWrite(startCursor(SITE), { lastSeq: 3, count: 2 });
    const step = follow(cursor, [entry(1), entry(2), entry(3), entry(4)]);
    expect(step.received.map(e => e.seq)).toEqual([1, 4]);
    expect(step.cursor.lastSeq).toBe(4);
    expect(step.cursor.own.size).toBe(0);
  });

  it('s’arrête avant un trou', () => {
    const step = follow(startCursor(SITE), [entry(1), entry(3)]);
    expect(step.received.map(e => e.seq)).toEqual([1]);
    expect(step.cursor.lastSeq).toBe(1);
    expect(step.gap).toBe(true);
  });
});

describe('S6.6 — l’interrogation', () => {
  /** Un ordonnanceur à la main : rien ne part avant `run`. */
  function manual() {
    const queue: (() => void)[] = [];
    const schedule = (run: () => void) => { queue.push(run); return () => { queue.length = 0; }; };
    const next = async () => { queue.shift()?.(); await new Promise(r => { setTimeout(r, 0); }); };
    return { schedule, next, queue };
  }

  it('ne perd rien après une coupure : le curseur reste où il était', async () => {
    const { schedule, next } = manual();
    let cursor: JournalCursor = startCursor(SITE);
    const answers: ReadOutcome[] = [
      { ok: false, cause: 'transport', findings: [] },
      { ok: true, entries: [entry(1), entry(2)] },
    ];
    const asked: number[] = [];
    const failures: string[] = [];
    const stop = pollJournal({
      read: async afterSeq => { asked.push(afterSeq); return answers.shift() ?? { ok: true, entries: [] }; },
      cursor: () => cursor,
      onStep: step => { cursor = step.cursor; },
      onFailure: f => { failures.push(f.cause); },
      schedule,
    });
    await next();
    await next();
    stop();
    expect(failures).toEqual(['transport']);
    expect(asked).toEqual([0, 0]);
    expect(cursor.lastSeq).toBe(2);
  });

  it('attend le retour d’une écriture en vol', async () => {
    const { schedule, next } = manual();
    let busy = true;
    let reads = 0;
    const stop = pollJournal({
      read: async () => { reads += 1; return { ok: true, entries: [] }; },
      cursor: () => startCursor(SITE),
      onStep: () => undefined,
      onFailure: () => undefined,
      busy: () => busy,
      schedule,
    });
    await next();
    expect(reads).toBe(0);
    busy = false;
    await next();
    stop();
    expect(reads).toBe(1);
  });

  it('ne programme plus rien une fois arrêtée', async () => {
    const { schedule, next, queue } = manual();
    const stop = pollJournal({
      read: async () => ({ ok: true, entries: [] }),
      cursor: () => startCursor(SITE),
      onStep: () => undefined,
      onFailure: () => undefined,
      schedule,
    });
    stop();
    await next();
    expect(queue.length).toBe(0);
  });
});

describe('S6.6c — l’émetteur suivi', () => {
  it('suspend l’interrogation pendant l’écriture et inscrit ses numéros', async () => {
    const cursor: { current: JournalCursor | null } = { current: startCursor(SITE, 4) };
    const inFlight = { current: 0 };
    let seenInFlight = -1;
    const send = trackOwnWrites(async () => {
      seenInFlight = inFlight.current;
      return { ok: true, value: { lastSeq: 6, count: 2 }, warnings: [] };
    }, cursor, inFlight);

    const out = await send([cmd('a'), cmd('b')]);
    expect(out.ok).toBe(true);
    expect(seenInFlight).toBe(1);
    expect(inFlight.current).toBe(0);
    expect([...(cursor.current?.own ?? [])]).toEqual([5, 6]);
    // Relues, les deux entrées font avancer le curseur sans être rendues.
    const cur = cursor.current;
    if (cur === null) throw new Error('curseur');
    expect(follow(cur, [entry(5), entry(6)]).received).toEqual([]);
  });

  it('un refus n’inscrit rien et libère l’interrogation', async () => {
    const cursor: { current: JournalCursor | null } = { current: startCursor(SITE, 4) };
    const inFlight = { current: 0 };
    const send = trackOwnWrites(async () => ({ ok: false, findings: [] }), cursor, inFlight);
    expect((await send([cmd('a')])).ok).toBe(false);
    expect(inFlight.current).toBe(0);
    expect(cursor.current?.own.size).toBe(0);
  });

  it('sans curseur posé, l’écriture passe sans rien inscrire', async () => {
    const cursor: { current: JournalCursor | null } = { current: null };
    const inFlight = { current: 0 };
    const send = trackOwnWrites(async () => ({ ok: true, value: { lastSeq: 1, count: 1 }, warnings: [] }), cursor, inFlight);
    expect((await send([cmd('a')])).ok).toBe(true);
    expect(cursor.current).toBeNull();
  });
});
