/**
 * B5, décisions QB0 et QB2 — demander au service le passage de validation du
 * graphe (travail `audit_site`), en suivre l'issue, et relire le passage.
 *
 * Seul un passage du service ouvre la soumission du tableau des messages
 * (0085, M02.W11) : le poste ne valide plus pour la base, il demande. Chaque
 * réponse est relue avant de servir, comme les entrées du journal.
 */
import type { Finding } from '@azimut/core-model';
import type { SinkConfig } from './postgrest-sink.js';
import { bearerToken } from '../auth/access-token.js';

/** Intervalle de lecture de l'état du travail. Constante technique. */
export const SERVICE_POLL_MS = 2_000;

/**
 * Au-delà, l'écran cesse d'attendre et le dit : le travail reste en file, et
 * le service le traitera quand il tournera. Constante technique.
 */
export const SERVICE_WAIT_MS = 120_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEVERITIES = ['blocking', 'warning', 'info'] as const;

function headers(config: SinkConfig, write: boolean): Record<string, string> {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.accessToken ?? bearerToken(config.apiKey)}`,
    [write ? 'Content-Profile' : 'Accept-Profile']: config.schema,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(write ? { Prefer: 'return=representation' } : {}),
  };
}

async function firstRow(response: Response | null): Promise<Record<string, unknown> | null> {
  if (response === null || !response.ok) return null;
  try {
    const rows = await response.json() as unknown;
    const row = Array.isArray(rows) ? rows[0] as unknown : null;
    return typeof row === 'object' && row !== null ? row as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function call(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetchImpl(url, init);
  } catch {
    return null;
  }
}

/** Demande un travail `audit_site` pour le site. Rend son identifiant, ou `null`. */
export async function requestServiceValidation(
  config: SinkConfig, orgId: string, siteId: string, fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!UUID.test(orgId) || !UUID.test(siteId)) return null;
  const row = await firstRow(await call(fetchImpl, `${config.url}/job?select=id`, {
    method: 'POST',
    headers: headers(config, true),
    body: JSON.stringify({ org_id: orgId, kind: 'audit_site', payload: { site_id: siteId, mode: 'atelier' } }),
  }));
  const id = row?.['id'];
  return typeof id === 'string' && UUID.test(id) ? id : null;
}

export type ServiceJob =
  | { readonly state: 'queued' | 'running' }
  | { readonly state: 'succeeded'; readonly validationId: string }
  | { readonly state: 'failed' | 'cancelled' };

/** L'état du travail, ou `null` si la lecture a échoué ou ne se relit pas. */
export async function readServiceJob(
  config: SinkConfig, jobId: string, fetchImpl: typeof fetch = fetch,
): Promise<ServiceJob | null> {
  if (!UUID.test(jobId)) return null;
  const search = new URLSearchParams({ select: 'state,result', id: `eq.${jobId}` });
  const row = await firstRow(await call(fetchImpl, `${config.url}/job?${search.toString()}`, {
    headers: headers(config, false),
  }));
  const state = row?.['state'];
  if (state === 'queued' || state === 'running' || state === 'failed' || state === 'cancelled') return { state };
  if (state !== 'succeeded') return null;
  const result = row?.['result'];
  const passage = typeof result === 'object' && result !== null
    ? (result as Record<string, unknown>)['graph_validation'] : null;
  const id = typeof passage === 'object' && passage !== null ? (passage as Record<string, unknown>)['id'] : null;
  return typeof id === 'string' && UUID.test(id) ? { state: 'succeeded', validationId: id } : null;
}

function findingOf(value: unknown): Finding | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const severity = v['severity'];
  if (typeof v['code'] !== 'string' || !(SEVERITIES as readonly unknown[]).includes(severity)) return null;
  const entity = v['entity'];
  const params = v['params'];
  const ruleRef = v['ruleRef'];
  return {
    code: v['code'],
    severity: severity as Finding['severity'],
    entity: typeof entity === 'object' && entity !== null
      && typeof (entity as Record<string, unknown>)['kind'] === 'string'
      && typeof (entity as Record<string, unknown>)['id'] === 'string'
      ? { kind: (entity as Record<string, string>)['kind'] ?? '', id: (entity as Record<string, string>)['id'] ?? '' }
      : null,
    params: typeof params === 'object' && params !== null
      ? Object.fromEntries(Object.entries(params as Record<string, unknown>)
        .filter((e): e is [string, string | number] => typeof e[1] === 'string' || typeof e[1] === 'number'))
      : {},
    ruleRef: typeof ruleRef === 'string' ? ruleRef : null,
  };
}

export type ServicePassageRead = { readonly findings: readonly Finding[]; readonly ranAt: string };

/** Le passage inscrit par le service, ou `null`. Un constat qui ne se relit pas est écarté. */
export async function readServicePassage(
  config: SinkConfig, validationId: string, fetchImpl: typeof fetch = fetch,
): Promise<ServicePassageRead | null> {
  if (!UUID.test(validationId)) return null;
  const search = new URLSearchParams({ select: 'findings,ran_at', id: `eq.${validationId}` });
  const row = await firstRow(await call(fetchImpl, `${config.url}/graph_validation?${search.toString()}`, {
    headers: headers(config, false),
  }));
  const findings = row?.['findings'];
  const ranAt = row?.['ran_at'];
  if (!Array.isArray(findings) || typeof ranAt !== 'string') return null;
  return {
    findings: (findings as unknown[]).map(findingOf).filter((f): f is Finding => f !== null),
    ranAt,
  };
}
