/**
 * D9 — State machines. Unlisted transitions are forbidden.
 */
import { admittedEvents } from './support-version-state.js';
import { SUPPORT_VERSION_STATES } from './site.js';

type TransitionMap = ReadonlyMap<string, ReadonlySet<string>>;

function buildMap(
  entries: readonly (readonly [string, string])[],
): TransitionMap {
  const m = new Map<string, Set<string>>();
  for (const [from, to] of entries) {
    let s = m.get(from);
    if (!s) { s = new Set(); m.set(from, s); }
    s.add(to);
  }
  return m;
}

function assertTransition(
  map: TransitionMap,
  domain: string,
  from: string,
  to: string,
): void {
  const allowed = map.get(from);
  if (!allowed || !allowed.has(to)) {
    throw new Error(
      `${domain}: transition ${from} → ${to} is forbidden`,
    );
  }
}

/**
 * D9 / G7 — la machine des versions de support et d'épreuve.
 *
 * Une seule table, celle de `support-version-state.ts`, qui porte les
 * événements et les effets en plus des états. Elle était recopiée ici en
 * états seuls ; deux tables décrivant la même machine finissent par diverger,
 * et c'est celle qui porte G7 — rien n'est admis depuis `approved` sauf le
 * remplacement — qui doit faire foi (invariant 1).
 */
const PROOF_TRANSITIONS = buildMap(
  SUPPORT_VERSION_STATES.flatMap(from =>
    admittedEvents(from).map((admitted): readonly [string, string] =>
      [from, admitted.to],
    ),
  ),
);

export function assertProofTransition(from: string, to: string): void {
  assertTransition(PROOF_TRANSITIONS, 'ProofVersion', from, to);
}

const JOB_TRANSITIONS = buildMap([
  ['queued', 'running'],
  ['queued', 'cancelled'],
  ['running', 'succeeded'],
  ['running', 'failed'],
  ['running', 'queued'],
]);

export function assertJobTransition(from: string, to: string): void {
  assertTransition(JOB_TRANSITIONS, 'Job', from, to);
}

const DIVERGENCE_TRANSITIONS = buildMap([
  ['detected', 'resolved'],
  ['detected', 'accepted'],
]);

export function assertDivergenceTransition(
  from: string,
  to: string,
): void {
  assertTransition(DIVERGENCE_TRANSITIONS, 'Divergence', from, to);
}

const WORK_ORDER_TRANSITIONS = buildMap([
  ['draft', 'issued'],
  ['draft', 'cancelled'],
  ['issued', 'in_progress'],
  ['issued', 'cancelled'],
  ['in_progress', 'done'],
  ['in_progress', 'cancelled'],
]);

export function assertWorkOrderTransition(
  from: string,
  to: string,
): void {
  assertTransition(WORK_ORDER_TRANSITIONS, 'WorkOrder', from, to);
}
