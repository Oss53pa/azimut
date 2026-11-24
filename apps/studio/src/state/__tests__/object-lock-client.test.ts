import { describe, it, expect } from 'vitest';
import { acquireLock, releaseLock } from '../object-lock-client.js';
import { refusal } from '../postgrest-sink.js';
import { buildCommand } from '@azimut/core-model';

const CONFIG = { url: 'https://example.invalid/rest/v1', apiKey: 'clé-de-test', schema: 'azimut', accessToken: 'jeton' };
const NODE = 'aaaaaaaa-0000-4000-8000-0000000000e1';

function responder(status: number) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as unknown });
    return new Response(status === 204 ? null : '"2026-11-24T10:01:00+00:00"', { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe('S6.4 — poser et lever un verrou', () => {
  it('posé : held ; tenu par un autre : locked ; autre échec : failed', async () => {
    const ok = responder(200);
    expect(await acquireLock(CONFIG, { table: 'node', id: NODE }, ok.fetchImpl)).toBe('held');
    expect(ok.calls[0]?.url).toBe(`${CONFIG.url}/rpc/acquire_object_lock`);
    expect(ok.calls[0]?.body).toEqual({ p_table: 'node', p_id: NODE });
    expect(await acquireLock(CONFIG, { table: 'node', id: NODE }, responder(423).fetchImpl)).toBe('locked');
    expect(await acquireLock(CONFIG, { table: 'node', id: NODE }, responder(403).fetchImpl)).toBe('failed');
  });

  it('une cible mal formée ne part pas', async () => {
    const r = responder(200);
    expect(await acquireLock(CONFIG, { table: 'node; drop', id: NODE }, r.fetchImpl)).toBe('failed');
    expect(await acquireLock(CONFIG, { table: 'node', id: 'x' }, r.fetchImpl)).toBe('failed');
    await releaseLock(CONFIG, { table: 'Node', id: NODE }, r.fetchImpl);
    expect(r.calls).toEqual([]);
  });

  it('lever appelle release_object_lock', async () => {
    const r = responder(204);
    await releaseLock(CONFIG, { table: 'edge', id: NODE }, r.fetchImpl);
    expect(r.calls[0]?.url).toBe(`${CONFIG.url}/rpc/release_object_lock`);
  });
});

describe('S6.4, Q5 — un refus 423 se dit EDIT.OBJECT_LOCKED', () => {
  const built = buildCommand({
    operation: 'update', module: '01-socle', table: 'node', id: NODE, org_id: NODE,
    before: { label: 'a' }, after: { label: 'b' }, timestamp: '2026-11-24T10:00:00.000Z',
  });
  if (!built.ok) throw new Error('commande');

  it('423 : objet verrouillé, cause gardée pour le tri des refus définitifs', () => {
    expect(refusal([built.value], '423')).toMatchObject({
      code: 'EDIT.OBJECT_LOCKED', ruleRef: 'S-20', params: { commands: 1, cause: '423' },
    });
  });

  it('tout autre statut reste un refus d’écriture', () => {
    expect(refusal([built.value], '409').code).toBe('EDIT.WRITE_REFUSED');
  });
});
