import { describe, it, expect } from 'vitest';
import { buildCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import { createPostgrestSink } from '../postgrest-sink.js';

const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';
const CONFIG = { url: 'https://example.invalid/rest/v1', apiKey: 'clé-de-test', schema: 'azimut' };

function cmd(id: string): EntityCommand {
  const out = buildCommand({
    operation: 'create', module: '01-socle', table: 'site', id, org_id: ORG,
    after: { id, org_id: ORG, name: 'Site', country_code: 'FR' },
    timestamp: '2026-09-21T10:00:00.000Z', groupKey: 'geste',
  });
  if (!out.ok) throw new Error('commande invalide');
  return out.value;
}

function recorder(status = 200): { fetchImpl: typeof fetch; calls: { url: string; body: unknown }[] } {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? 'null')) });
    return new Response(null, { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('émetteur de commandes du poste', () => {
  it('appelle la fonction de base, une seule fois pour tout le geste', async () => {
    const { fetchImpl, calls } = recorder();
    const sink = createPostgrestSink(CONFIG, fetchImpl);
    const r = await sink([cmd('site-1'), cmd('site-2')]);
    expect(r.ok).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0]?.url).toContain('/rpc/apply_commands');
  });

  /**
   * Le module et l'horodatage restent au poste : la base ne les lit pas, et
   * les envoyer laisserait croire qu'elle s'en sert.
   */
  it('n’envoie que ce que la base lit', async () => {
    const { fetchImpl, calls } = recorder();
    await createPostgrestSink(CONFIG, fetchImpl)([cmd('site-1')]);
    const body = calls[0]?.body as { commands: Record<string, unknown>[] };
    expect(Object.keys(body.commands[0] ?? {}).sort()).toEqual(['after', 'id', 'operation', 'table']);
  });

  it('omet l’état absent plutôt que d’envoyer une valeur nulle', async () => {
    const { fetchImpl, calls } = recorder();
    await createPostgrestSink(CONFIG, fetchImpl)([cmd('site-1')]);
    const body = calls[0]?.body as { commands: Record<string, unknown>[] };
    expect('before' in (body.commands[0] ?? {})).toBe(false);
  });

  it('n’appelle rien pour une suite vide', async () => {
    const { fetchImpl, calls } = recorder();
    const r = await createPostgrestSink(CONFIG, fetchImpl)([]);
    expect(r.ok).toBe(true);
    expect(calls.length).toBe(0);
  });

  /**
   * A6.1 : « un utilisateur de l'organisation A ne peut lire, écrire, ni
   * détecter l'existence d'aucune ligne de l'organisation B, y compris par
   * message d'erreur ». Le message de la base ne remonte donc pas.
   */
  it('rend un refus sans le message de la base', async () => {
    const { fetchImpl } = recorder(403);
    const r = await createPostgrestSink(CONFIG, fetchImpl)([cmd('site-1')]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.findings[0]?.code).toBe('EDIT.WRITE_REFUSED');
      expect(JSON.stringify(r.findings[0]?.params)).not.toContain('organisation');
    }
  });

  it('rend un refus quand le transport échoue', async () => {
    const fetchImpl = (async () => { throw new Error('réseau coupé'); }) as unknown as typeof fetch;
    const r = await createPostgrestSink(CONFIG, fetchImpl)([cmd('site-1')]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings[0]?.params['cause']).toBe('transport');
  });
});
