import { describe, it, expect } from 'vitest';
import {
  assertProofTransition,
  assertJobTransition,
  assertDivergenceTransition,
  assertWorkOrderTransition,
} from '../index.js';

/**
 * Compute all forbidden pairs: Cartesian product of states minus
 * the allowed transitions set.
 */
function forbiddenPairs(
  states: readonly string[],
  allowed: readonly (readonly [string, string])[],
): [string, string][] {
  const allowedSet = new Set(allowed.map(([f, t]) => `${f}->${t}`));
  const pairs: [string, string][] = [];
  for (const from of states) {
    for (const to of states) {
      if (!allowedSet.has(`${from}->${to}`)) {
        pairs.push([from, to]);
      }
    }
  }
  return pairs;
}

// ── Proof version ──────────────────────────────────

const PROOF_STATES = ['draft', 'in_review', 'approved', 'superseded'] as const;
const PROOF_ALLOWED: [string, string][] = [
  ['draft', 'in_review'],
  ['draft', 'draft'],
  ['in_review', 'draft'],
  ['in_review', 'approved'],
  ['approved', 'superseded'],
];

describe('D9.1 — proof version state machine', () => {
  it.each(PROOF_ALLOWED)('allows %s → %s', (from, to) => {
    expect(() => assertProofTransition(from, to)).not.toThrow();
  });

  it.each(forbiddenPairs(PROOF_STATES, PROOF_ALLOWED))(
    'forbids %s → %s',
    (from, to) => {
      expect(() => assertProofTransition(from, to)).toThrow(/forbidden/);
    },
  );
});

// ── Job ────────────────────────────────────────────

const JOB_STATES = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
const JOB_ALLOWED: [string, string][] = [
  ['queued', 'running'],
  ['queued', 'cancelled'],
  ['running', 'succeeded'],
  ['running', 'failed'],
  ['running', 'queued'],
];

describe('D9.2 — job state machine', () => {
  it.each(JOB_ALLOWED)('allows %s → %s', (from, to) => {
    expect(() => assertJobTransition(from, to)).not.toThrow();
  });

  it.each(forbiddenPairs(JOB_STATES, JOB_ALLOWED))(
    'forbids %s → %s',
    (from, to) => {
      expect(() => assertJobTransition(from, to)).toThrow(/forbidden/);
    },
  );
});

// ── Divergence ─────────────────────────────────────

const DIVERGENCE_STATES = ['detected', 'resolved', 'accepted'] as const;
const DIVERGENCE_ALLOWED: [string, string][] = [
  ['detected', 'resolved'],
  ['detected', 'accepted'],
];

describe('D9.3 — divergence state machine', () => {
  it.each(DIVERGENCE_ALLOWED)('allows %s → %s', (from, to) => {
    expect(() => assertDivergenceTransition(from, to)).not.toThrow();
  });

  it.each(forbiddenPairs(DIVERGENCE_STATES, DIVERGENCE_ALLOWED))(
    'forbids %s → %s',
    (from, to) => {
      expect(() => assertDivergenceTransition(from, to)).toThrow(/forbidden/);
    },
  );
});

// ── Work order ─────────────────────────────────────

const WORK_ORDER_STATES = ['draft', 'issued', 'in_progress', 'done', 'cancelled'] as const;
const WORK_ORDER_ALLOWED: [string, string][] = [
  ['draft', 'issued'],
  ['draft', 'cancelled'],
  ['issued', 'in_progress'],
  ['issued', 'cancelled'],
  ['in_progress', 'done'],
  ['in_progress', 'cancelled'],
];

describe('D9.4 — work order state machine', () => {
  it.each(WORK_ORDER_ALLOWED)('allows %s → %s', (from, to) => {
    expect(() => assertWorkOrderTransition(from, to)).not.toThrow();
  });

  it.each(forbiddenPairs(WORK_ORDER_STATES, WORK_ORDER_ALLOWED))(
    'forbids %s → %s',
    (from, to) => {
      expect(() => assertWorkOrderTransition(from, to)).toThrow(/forbidden/);
    },
  );
});

// ── Edge cases ────────────────────────────────────

describe('D9 — unknown and edge-case states', () => {
  it('rejects completely unknown from-state', () => {
    expect(() => assertJobTransition('nonexistent', 'running')).toThrow(/forbidden/);
  });

  it('rejects completely unknown to-state', () => {
    expect(() => assertProofTransition('draft', 'nonexistent')).toThrow(/forbidden/);
  });

  it('rejects empty string as from-state', () => {
    expect(() => assertJobTransition('', 'running')).toThrow(/forbidden/);
  });

  it('rejects empty string as to-state', () => {
    expect(() => assertDivergenceTransition('detected', '')).toThrow(/forbidden/);
  });

  it('error message includes domain name — Job', () => {
    expect(() => assertJobTransition('succeeded', 'queued'))
      .toThrow(/Job/);
  });

  it('error message includes domain name — ProofVersion', () => {
    expect(() => assertProofTransition('superseded', 'draft'))
      .toThrow(/ProofVersion/);
  });

  it('error message includes domain name — Divergence', () => {
    expect(() => assertDivergenceTransition('resolved', 'detected'))
      .toThrow(/Divergence/);
  });

  it('error message includes domain name — WorkOrder', () => {
    expect(() => assertWorkOrderTransition('done', 'draft'))
      .toThrow(/WorkOrder/);
  });

  it('error message includes from and to state names', () => {
    try {
      assertJobTransition('succeeded', 'queued');
      expect.unreachable('should have thrown');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toContain('succeeded');
      expect(msg).toContain('queued');
    }
  });

  it('self-transition on terminal state throws', () => {
    expect(() => assertProofTransition('superseded', 'superseded')).toThrow(/forbidden/);
    expect(() => assertJobTransition('succeeded', 'succeeded')).toThrow(/forbidden/);
    expect(() => assertDivergenceTransition('resolved', 'resolved')).toThrow(/forbidden/);
    expect(() => assertWorkOrderTransition('done', 'done')).toThrow(/forbidden/);
  });
});
