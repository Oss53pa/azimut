/**
 * D9 — State machines. Unlisted transitions are forbidden.
 */

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

const PROOF_TRANSITIONS = buildMap([
  ['draft', 'in_review'],
  ['draft', 'draft'],
  ['in_review', 'draft'],
  ['in_review', 'approved'],
  ['approved', 'superseded'],
]);

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
