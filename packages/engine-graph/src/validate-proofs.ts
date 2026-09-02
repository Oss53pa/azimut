import type {
  Proof,
  Approval,
  Finding,
  Outcome,
} from '@azimut/core-model';

export type ProofValidationResult = {
  readonly total_proofs: number;
  readonly total_approvals: number;
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly superseded: number;
};

export function validateProofs(
  proofs: readonly Proof[],
  approvals: readonly Approval[],
): Outcome<ProofValidationResult> {
  const findings: Finding[] = [];

  const approvalsByProof = new Map<string, Approval[]>();
  for (const a of approvals) {
    const list = approvalsByProof.get(a.proof_id) ?? [];
    list.push(a);
    approvalsByProof.set(a.proof_id, list);
  }

  const sortedProofs = [...proofs].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const proof of sortedProofs) {
    const proofApprovals = approvalsByProof.get(proof.id) ?? [];

    if (proof.status === 'approved' || proof.status === 'rejected') {
      if (proofApprovals.length === 0) {
        findings.push({
          code: 'PROOF.STATUS_WITHOUT_APPROVAL',
          severity: 'blocking',
          entity: { kind: 'proof', id: proof.id },
          params: { status: proof.status },
          ruleRef: null,
        });
      }
    }

    if (proof.status === 'pending' && proofApprovals.length > 0) {
      findings.push({
        code: 'PROOF.PENDING_WITH_APPROVAL',
        severity: 'warning',
        entity: { kind: 'proof', id: proof.id },
        params: { approval_count: proofApprovals.length },
        ruleRef: null,
      });
    }
  }

  const faceVersions = new Map<string, number[]>();
  for (const proof of sortedProofs) {
    const versions = faceVersions.get(proof.face_id) ?? [];
    versions.push(proof.version);
    faceVersions.set(proof.face_id, versions);
  }

  const sortedFaceIds = [...faceVersions.keys()].sort();
  for (const faceId of sortedFaceIds) {
    const versions = faceVersions.get(faceId) ?? [];
    const sorted = [...versions].sort((a, b) => a - b);
    const uniqueVersions = new Set(sorted);
    if (uniqueVersions.size < sorted.length) {
      findings.push({
        code: 'PROOF.DUPLICATE_VERSION',
        severity: 'blocking',
        entity: { kind: 'support_face', id: faceId },
        params: { versions: sorted.join(',') },
        ruleRef: null,
      });
    }
  }

  const blockings = findings.filter((f) => f.severity === 'blocking');
  const warnings = findings.filter((f) => f.severity !== 'blocking');

  const counts = { pending: 0, approved: 0, rejected: 0, superseded: 0 };
  for (const proof of proofs) {
    counts[proof.status]++;
  }

  if (blockings.length > 0) {
    return { ok: false, findings: [...blockings, ...warnings] };
  }

  return {
    ok: true,
    value: {
      total_proofs: proofs.length,
      total_approvals: approvals.length,
      ...counts,
    },
    warnings,
  };
}
