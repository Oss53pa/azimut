import { describe, it, expect } from 'vitest';
import { validateProofs } from '../validate-proofs.js';
import type { Proof, Approval } from '@azimut/core-model';

function makeProof(overrides?: Partial<Proof>): Proof {
  return {
    id: 'proof-001',
    org_id: 'org-001',
    face_id: 'face-001',
    version: 1,
    storage_path: '/proofs/proof-001.pdf',
    status: 'pending',
    submitted_at: '2024-06-01T00:00:00Z',
    reviewed_at: null,
    reviewer_id: null,
    ...overrides,
  };
}

function makeApproval(overrides?: Partial<Approval>): Approval {
  return {
    id: 'approval-001',
    org_id: 'org-001',
    proof_id: 'proof-001',
    decision: 'approved',
    reviewer_id: 'user-001',
    comment: '',
    decided_at: '2024-06-02T00:00:00Z',
    ...overrides,
  };
}

describe('T-2.14 validateProofs', () => {
  it('returns clean report for consistent data', () => {
    const proofs = [
      makeProof({ status: 'approved', reviewed_at: '2024-06-02T00:00:00Z' }),
    ];
    const approvals = [makeApproval()];

    const result = validateProofs(proofs, approvals);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_proofs).toBe(1);
    expect(result.value.total_approvals).toBe(1);
    expect(result.value.approved).toBe(1);
  });

  it('detects approved proof without approval record', () => {
    const proofs = [
      makeProof({ status: 'approved' }),
    ];

    const result = validateProofs(proofs, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('DATA.PROOF_STATUS_WITHOUT_APPROVAL');
  });

  it('detects rejected proof without approval record', () => {
    const proofs = [
      makeProof({ status: 'rejected' }),
    ];

    const result = validateProofs(proofs, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('DATA.PROOF_STATUS_WITHOUT_APPROVAL');
  });

  it('warns on pending proof that has approval records', () => {
    const proofs = [makeProof({ status: 'pending' })];
    const approvals = [makeApproval()];

    const result = validateProofs(proofs, approvals);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]?.code).toBe('DATA.PROOF_PENDING_WITH_APPROVAL');
  });

  it('detects duplicate version numbers on same face', () => {
    const proofs = [
      makeProof({ id: 'proof-001', face_id: 'face-A', version: 1 }),
      makeProof({ id: 'proof-002', face_id: 'face-A', version: 1 }),
    ];

    const result = validateProofs(proofs, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some(
      (f) => f.code === 'DATA.PROOF_DUPLICATE_VERSION',
    )).toBe(true);
  });

  it('allows same version on different faces', () => {
    const proofs = [
      makeProof({ id: 'proof-001', face_id: 'face-A', version: 1 }),
      makeProof({ id: 'proof-002', face_id: 'face-B', version: 1 }),
    ];

    const result = validateProofs(proofs, []);
    expect(result.ok).toBe(true);
  });

  it('counts status breakdown correctly', () => {
    const proofs = [
      makeProof({ id: 'p1', status: 'pending' }),
      makeProof({
        id: 'p2',
        status: 'approved',
        face_id: 'face-002',
        version: 1,
      }),
      makeProof({
        id: 'p3',
        status: 'rejected',
        face_id: 'face-003',
        version: 1,
      }),
      makeProof({
        id: 'p4',
        status: 'superseded',
        face_id: 'face-004',
        version: 1,
      }),
    ];
    const approvals = [
      makeApproval({ id: 'a1', proof_id: 'p2', decision: 'approved' }),
      makeApproval({ id: 'a2', proof_id: 'p3', decision: 'rejected' }),
    ];

    const result = validateProofs(proofs, approvals);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pending).toBe(1);
    expect(result.value.approved).toBe(1);
    expect(result.value.rejected).toBe(1);
    expect(result.value.superseded).toBe(1);
  });

  it('handles empty inputs', () => {
    const result = validateProofs([], []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_proofs).toBe(0);
    expect(result.value.total_approvals).toBe(0);
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const proofs = [makeProof()];
      const approvals = [makeApproval()];
      const r1 = validateProofs(proofs, approvals);
      const r2 = validateProofs(proofs, approvals);
      expect(r1).toStrictEqual(r2);
    });
  });

  it('orphaned approvals referencing nonexistent proofs are silently ignored', () => {
    const proofs = [makeProof({ id: 'proof-001', status: 'pending' })];
    const approvals = [
      makeApproval({ id: 'a-orphan', proof_id: 'proof-missing' }),
    ];
    const result = validateProofs(proofs, approvals);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Orphaned approval still counted in total_approvals
    expect(result.value.total_approvals).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it('multiple approvals on pending proof reports correct count', () => {
    const proofs = [makeProof({ id: 'proof-001', status: 'pending' })];
    const approvals = [
      makeApproval({ id: 'a1', proof_id: 'proof-001' }),
      makeApproval({ id: 'a2', proof_id: 'proof-001' }),
      makeApproval({ id: 'a3', proof_id: 'proof-001' }),
    ];
    const result = validateProofs(proofs, approvals);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.params?.['approval_count']).toBe(3);
  });

  it('superseded proof without approvals produces no finding', () => {
    const proofs = [
      makeProof({ id: 'proof-001', status: 'superseded', face_id: 'f1', version: 1 }),
    ];
    const result = validateProofs(proofs, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.superseded).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });
});
