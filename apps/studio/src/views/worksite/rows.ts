/**
 * H6.2 — les lignes des écrans du chantier : lots, réserves de pose.
 *
 * Une réserve ouverte vient du garde `auditInstallReserves` : on ne la juge
 * pas ici, on range son anomalie sous la réserve et sous le lot. Un lot n'est
 * « prêt à poser » que si aucune de ses réserves n'est ouverte.
 */
import type { FabricationLot, Finding, RecordedReserve } from '@azimut/core-model';
import { auditInstallReserves } from '../../domain/install-reserves.js';

export type ReserveRow = {
  readonly reserve: RecordedReserve;
  /** L'anomalie du garde, ou `null` pour une réserve levée. */
  readonly finding: Finding | null;
};

export type LotRow = {
  readonly lot: FabricationLot;
  readonly reserves: readonly ReserveRow[];
  readonly open: number;
};

/** Les anomalies du garde : une par réserve ouverte. */
export function openReserveFindings(reserves: readonly RecordedReserve[]): readonly Finding[] {
  const audit = auditInstallReserves(reserves.map(r => ({ id: r.id, support_id: r.support_id, lifted: r.lifted_at !== null })));
  return audit.ok ? audit.warnings : audit.findings;
}

export function reserveRows(reserves: readonly RecordedReserve[]): readonly ReserveRow[] {
  const findings = openReserveFindings(reserves);
  return [...reserves]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(reserve => ({
      reserve,
      finding: findings.find(f => f.entity?.id === reserve.id) ?? null,
    }));
}

export function lotRows(lots: readonly FabricationLot[], reserves: readonly RecordedReserve[]): readonly LotRow[] {
  const rows = reserveRows(reserves);
  return [...lots]
    .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id))
    .map(lot => {
      const own = rows.filter(r => r.reserve.lot_id === lot.id);
      return { lot, reserves: own, open: own.filter(r => r.finding !== null).length };
    });
}
