import { describe, it, expect } from 'vitest';
import { buildCommand } from '@azimut/core-model';
import { readServiceJob, readServicePassage, requestServiceValidation } from '../service-validation-request.js';
import { refusal } from '../postgrest-sink.js';

const CONFIG = { url: 'https://example.invalid/rest/v1', apiKey: 'clé-de-test', schema: 'azimut', accessToken: 'jeton' };
const ORG = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const SITE = 'aaaaaaaa-0000-4000-8000-0000000000b1';
const JOB = 'aaaaaaaa-0000-4000-8000-0000000000c1';
const RUN = 'aaaaaaaa-0000-4000-8000-0000000000c2';

function answering(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe('B5 — demander le passage au service', () => {
  it('pose un travail audit_site pour le site, et rend son identifiant', async () => {
    const r = answering(201, [{ id: JOB }]);
    expect(await requestServiceValidation(CONFIG, ORG, SITE, r.fetchImpl)).toBe(JOB);
    expect(JSON.parse(String(r.calls[0]?.init?.body))).toEqual({
      org_id: ORG, kind: 'audit_site', payload: { site_id: SITE, mode: 'atelier' },
    });
  });

  it('un refus, un identifiant illisible, un site mal formé : null', async () => {
    expect(await requestServiceValidation(CONFIG, ORG, SITE, answering(403, []).fetchImpl)).toBeNull();
    expect(await requestServiceValidation(CONFIG, ORG, SITE, answering(201, [{ id: 'x' }]).fetchImpl)).toBeNull();
    const r = answering(201, [{ id: JOB }]);
    expect(await requestServiceValidation(CONFIG, ORG, 'site', r.fetchImpl)).toBeNull();
    expect(r.calls).toEqual([]);
  });

  it('l’état du travail ; réussi, il nomme son passage', async () => {
    expect(await readServiceJob(CONFIG, JOB, answering(200, [{ state: 'queued', result: null }]).fetchImpl)).toEqual({ state: 'queued' });
    expect(await readServiceJob(CONFIG, JOB, answering(200, [{ state: 'succeeded', result: { graph_validation: { id: RUN } } }]).fetchImpl))
      .toEqual({ state: 'succeeded', validationId: RUN });
    expect(await readServiceJob(CONFIG, JOB, answering(200, [{ state: 'succeeded', result: {} }]).fetchImpl)).toBeNull();
    expect(await readServiceJob(CONFIG, JOB, answering(200, [{ state: 'bizarre' }]).fetchImpl)).toBeNull();
  });

  it('le passage relu : un constat qui ne se relit pas est écarté', async () => {
    const read = await readServicePassage(CONFIG, RUN, answering(200, [{
      ran_at: '2026-11-25T10:00:00+00:00',
      findings: [
        { code: 'GRAPH.NODE_ORPHAN', severity: 'blocking', entity: { kind: 'node', id: 'n1' }, params: { a: 1 }, ruleRef: 'A7' },
        { code: 'X', severity: 'fatal' },
        'texte',
      ],
    }]).fetchImpl);
    expect(read?.findings).toEqual([
      { code: 'GRAPH.NODE_ORPHAN', severity: 'blocking', entity: { kind: 'node', id: 'n1' }, params: { a: 1 }, ruleRef: 'A7' },
    ]);
  });
});

describe('0085 — un refus 412 se dit GRAPH.NOT_VALIDATED', () => {
  it('par le code de R12, la cause gardée', () => {
    const built = buildCommand({
      operation: 'update', module: '01-socle', table: 'site', id: SITE, org_id: ORG,
      before: { name: 'Site' }, after: { name: 'Site Nord' }, timestamp: '2026-11-25T10:00:00.000Z',
    });
    if (!built.ok) throw new Error('commande');
    expect(refusal([built.value], '412')).toMatchObject({ code: 'GRAPH.NOT_VALIDATED', ruleRef: 'M02.W11', params: { cause: '412' } });
  });
});
