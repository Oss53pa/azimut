import type { Finding, Outcome } from '@azimut/core-model';

/**
 * H2.4 — The staggering plan (plan de jalonnement) produces, per route and
 * profile, the ordered sequence of decision points. Message continuity is
 * required: a destination announced at a point must be taken up or confirmed at
 * the next point, all the way until it is reached. A break in continuity is the
 * most frequent and least visible wayfinding error. This guard detects any
 * destination announced then dropped before being reached and raises a blocking
 * WAYFIND.CONTINUITY_BROKEN.
 */
export type JalonnementStep = {
  readonly point_id: string;
  /** Destinations announced at this decision point. */
  readonly announced: readonly string[];
  /** Destinations confirmed as reached at this point. */
  readonly reached: readonly string[];
};

export type JalonnementSequence = {
  /** Stable id of the route+profile sequence. */
  readonly id: string;
  readonly steps: readonly JalonnementStep[];
};

type Break = { reason: string; break_point: string };

function analyseDestination(
  steps: readonly JalonnementStep[],
  present: readonly boolean[],
  reachedIndex: number,
): Break | null {
  const firstIndex = present.indexOf(true);
  if (firstIndex === -1) return null; // never involved — nothing to check.

  if (reachedIndex === -1) {
    // Announced but never reached: abandoned before arrival.
    const point = steps[firstIndex]?.point_id ?? '';
    return { reason: 'never_reached', break_point: point };
  }

  // Continuity must hold contiguously from first announcement to arrival.
  for (let i = firstIndex; i <= reachedIndex; i++) {
    if (!present[i]) {
      const point = steps[i]?.point_id ?? '';
      return { reason: 'gap', break_point: point };
    }
  }
  return null;
}

/**
 * Guard message continuity across staggering sequences. Returns one blocking
 * WAYFIND.CONTINUITY_BROKEN per (sequence, destination) whose message is
 * interrupted before arrival, sorted by destination id then sequence id; the
 * finding names the sequence, the reason (gap | never_reached) and the point
 * where continuity breaks.
 */
export function guardWayfindingContinuity(
  sequences: readonly JalonnementSequence[],
): Outcome<null> {
  const findings: Finding[] = [];
  const sortedSequences = [...sequences].sort((a, b) => a.id.localeCompare(b.id));

  for (const sequence of sortedSequences) {
    const { steps } = sequence;

    // All destinations involved anywhere in this sequence.
    const destinations = new Set<string>();
    for (const step of steps) {
      for (const d of step.announced) destinations.add(d);
      for (const d of step.reached) destinations.add(d);
    }

    for (const destination of [...destinations].sort((a, b) => a.localeCompare(b))) {
      const present = steps.map(
        (s) => s.announced.includes(destination) || s.reached.includes(destination),
      );
      const reachedIndex = steps.findIndex((s) => s.reached.includes(destination));
      const broken = analyseDestination(steps, present, reachedIndex);
      if (broken !== null) {
        findings.push({
          code: 'WAYFIND.CONTINUITY_BROKEN',
          severity: 'blocking',
          entity: { kind: 'destination', id: destination },
          params: {
            sequence_id: sequence.id,
            reason: broken.reason,
            break_point: broken.break_point,
          },
          ruleRef: 'H2.4',
        });
      }
    }
  }

  findings.sort((a, b) => {
    const byDest = (a.entity?.id ?? '').localeCompare(b.entity?.id ?? '');
    if (byDest !== 0) return byDest;
    return String(a.params['sequence_id']).localeCompare(
      String(b.params['sequence_id']),
    );
  });

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
