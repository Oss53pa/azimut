import type { Finding, Outcome } from '@azimut/core-model';

/**
 * J4 — Revision annotations carry a reviewer's remark on a face, a support or a
 * plan zone, inside the proof (bon à tirer) and message-schedule validation
 * circuit. Their state is one of: open, handled, rejected. An open annotation
 * blocks the closure of a review — this guard is that control. It never touches
 * dressing annotations (which are printed) or the sketch layer.
 */
export const REVIEW_ANNOTATION_STATES = ['open', 'handled', 'rejected'] as const;
export type ReviewAnnotationState = (typeof REVIEW_ANNOTATION_STATES)[number];

/** Entity a revision annotation is anchored on — never floating (J4). */
export type ReviewAnchor = {
  readonly kind: string;
  readonly id: string;
};

export type ReviewAnnotation = {
  readonly id: string;
  readonly state: ReviewAnnotationState;
  readonly anchor: ReviewAnchor;
};

/**
 * Guard that a review can be closed: every revision annotation must be handled
 * or rejected. Returns one blocking REVIEW.ANNOTATION_OPEN finding per open
 * annotation, sorted by annotation id; ok when none remains open.
 */
export function guardReviewClosure(
  annotations: readonly ReviewAnnotation[],
): Outcome<null> {
  const findings: Finding[] = [];
  const sorted = [...annotations].sort((a, b) => a.id.localeCompare(b.id));

  for (const annotation of sorted) {
    if (annotation.state === 'open') {
      findings.push({
        code: 'REVIEW.ANNOTATION_OPEN',
        severity: 'blocking',
        entity: { kind: annotation.anchor.kind, id: annotation.id },
        params: {
          anchor_kind: annotation.anchor.kind,
          anchor_id: annotation.anchor.id,
        },
        ruleRef: 'J4',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
