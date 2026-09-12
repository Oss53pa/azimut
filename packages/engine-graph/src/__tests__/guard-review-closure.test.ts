import { describe, it, expect } from 'vitest';
import {
  guardReviewClosure,
  type ReviewAnnotation,
} from '../guard-review-closure.js';

const ann = (
  id: string,
  state: ReviewAnnotation['state'],
  anchorKind = 'support_face',
  anchorId = 'f-1',
): ReviewAnnotation => ({ id, state, anchor: { kind: anchorKind, id: anchorId } });

describe('J4 — guardReviewClosure', () => {
  it('closes a review when every annotation is handled or rejected', () => {
    const r = guardReviewClosure([
      ann('a-1', 'handled'),
      ann('a-2', 'rejected'),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it('closes an empty review (no-op)', () => {
    expect(guardReviewClosure([]).ok).toBe(true);
  });

  it('blocks closure with one open annotation', () => {
    const r = guardReviewClosure([ann('a-1', 'open', 'support', 's-42')]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('REVIEW.ANNOTATION_OPEN');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('J4');
    expect(r.findings[0]?.entity).toEqual({ kind: 'support', id: 'a-1' });
    expect(r.findings[0]?.params['anchor_id']).toBe('s-42');
  });

  it('reports one blocking finding per open annotation, sorted by id', () => {
    const r = guardReviewClosure([
      ann('a-c', 'open'),
      ann('a-a', 'handled'),
      ann('a-b', 'open'),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.entity?.id)).toEqual(['a-b', 'a-c']);
  });

  it('is deterministic regardless of input order', () => {
    const a = guardReviewClosure([ann('a-2', 'open'), ann('a-1', 'open')]);
    const b = guardReviewClosure([ann('a-1', 'open'), ann('a-2', 'open')]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
