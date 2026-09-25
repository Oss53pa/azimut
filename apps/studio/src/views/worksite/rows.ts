/**
 * H6.2 — les lignes des écrans du chantier : lots, réserves de pose.
 *
 * Une réserve ouverte vient du garde `auditInstallReserves` : on ne la juge
 * pas ici, on range son anomalie sous la réserve et sous le lot. Un lot n'est
 * « prêt à poser » que si aucune de ses réserves n'est ouverte.
 */
import type { Finding } from '@azimut/core-model';
import { auditInstallReserves } from '../../domain/install-reserves.js';
import type { ProductionLot, ReserveRecord } from '../../domain/demo/production.js';

export type ReserveRow = {
  readonly record: ReserveRecord;
  /** L'anomalie du garde, ou `null` pour une réserve levée. */
  readonly finding: Finding | null;
};

export type LotRow = {
  readonly lot: ProductionLot;
  readonly reserves: readonly ReserveRow[];
  readonly open: number;
};

export function reserveRows(records: readonly ReserveRecord[]): readonly ReserveRow[] {
  const audit = auditInstallReserves(records.map(r => r.reserve));
  const findings = audit.ok ? audit.warnings : audit.findings;
  return [...records]
    .sort((a, b) => a.reserve.id.localeCompare(b.reserve.id))
    .map(record => ({
      record,
      finding: findings.find(f => f.entity?.id === record.reserve.id) ?? null,
    }));
}

export function lotRows(lots: readonly ProductionLot[], records: readonly ReserveRecord[]): readonly LotRow[] {
  const reserves = reserveRows(records);
  return [...lots]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(lot => {
      const own = reserves.filter(r => r.record.lot_id === lot.id);
      return { lot, reserves: own, open: own.filter(r => r.finding !== null).length };
    });
}
