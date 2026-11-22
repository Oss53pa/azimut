import { describe, it, expect } from 'vitest';
import { othersPresent, presenceOf, readPresence, touchPresence } from '../presence.js';

const SELF = 'aaaaaaaa-0000-4000-8000-0000000000d1';
const OTHER = 'aaaaaaaa-0000-4000-8000-0000000000d2';
const THIRD = 'aaaaaaaa-0000-4000-8000-0000000000d3';
const LEVEL = 'aaaaaaaa-0000-4000-8000-0000000000b3';
const NODE = 'aaaaaaaa-0000-4000-8000-0000000000e1';
const CONFIG = { url: 'https://example.invalid/rest/v1', apiKey: 'clé-de-test', schema: 'azimut', accessToken: 'jeton' };

const row = (over: Record<string, unknown> = {}) => ({
  user_id: OTHER, display_name: 'Camille', role: 'designer',
  selection: [{ table: 'node', id: NODE }], zone: { x: 1, y: 2, w: 3, h: 4 },
  seen_at: '2026-11-22T10:00:00+00:00', last_change_at: '2026-11-22T09:58:00+00:00', ...over,
});

describe('S6.7b — relire une présence', () => {
  it('une ligne complète se relit', () => {
    expect(presenceOf(row())).toEqual({
      userId: OTHER, displayName: 'Camille', role: 'designer',
      selection: [{ table: 'node', id: NODE }], zone: { x: 1, y: 2, w: 3, h: 4 },
      lastChangeAt: '2026-11-22T09:58:00+00:00',
    });
  });

  it('sans nom, sans zone, sans modification : valeurs nulles, pas un rejet', () => {
    expect(presenceOf(row({ display_name: null, zone: null, last_change_at: null, selection: [] })))
      .toMatchObject({ displayName: null, zone: null, lastChangeAt: null, selection: [] });
  });

  it('une ligne qui ne se relit pas est écartée', () => {
    for (const bad of [
      null, 'texte', row({ user_id: 'x' }), row({ role: 'stagiaire' }), row({ display_name: 3 }),
      row({ selection: [{ table: 'node', id: 'x' }] }), row({ selection: {} }),
      row({ zone: { x: 1, y: 2, w: 3 } }), row({ zone: { x: '1', y: 2, w: 3, h: 4 } }),
      row({ last_change_at: 'hier' }),
    ]) expect(presenceOf(bad)).toBeNull();
  });

  it('les autres seulement, dans un ordre stable, les lignes fausses écartées', () => {
    const rows = [row({ user_id: THIRD }), row({ user_id: SELF }), row({ role: '?' }), row()];
    expect(othersPresent(rows, SELF).map(p => p.userId)).toEqual([OTHER, THIRD]);
  });
});

describe('S6.7b — les appels', () => {
  function recorder(status: number, body: unknown) {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as unknown });
      return new Response(status === 204 ? null : JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
  }

  it('s’annonce par touch_presence, avec la sélection et la zone', async () => {
    const r = recorder(204, null);
    expect(await touchPresence(CONFIG, LEVEL, [{ table: 'node', id: NODE }], null, r.fetchImpl)).toBe(true);
    expect(r.calls[0]?.url).toBe(`${CONFIG.url}/rpc/touch_presence`);
    expect(r.calls[0]?.body).toEqual({ p_level_id: LEVEL, p_selection: [{ table: 'node', id: NODE }], p_zone: null });
  });

  it('un niveau qui n’est pas un identifiant ne part pas', async () => {
    const r = recorder(204, null);
    expect(await touchPresence(CONFIG, 'niveau', [], null, r.fetchImpl)).toBe(false);
    expect(await readPresence(CONFIG, 'niveau', r.fetchImpl)).toBeNull();
    expect(r.calls).toEqual([]);
  });

  it('une lecture refusée ou mal formée rend null', async () => {
    expect(await readPresence(CONFIG, LEVEL, recorder(403, []).fetchImpl)).toBeNull();
    expect(await readPresence(CONFIG, LEVEL, recorder(200, { pas: 'une liste' }).fetchImpl)).toBeNull();
    expect(await readPresence(CONFIG, LEVEL, recorder(200, [row()]).fetchImpl)).toEqual([row()]);
  });
});
