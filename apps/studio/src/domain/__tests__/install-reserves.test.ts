import { describe, it, expect } from 'vitest';
import {
  auditInstallReserves,
  type InstallReserve,
} from '../install-reserves.js';

const rv = (id: string, lifted: boolean, support_id = 's-1'): InstallReserve => ({
  id,
  support_id,
  lifted,
});

describe('H6.2 — auditInstallReserves (INSTALL.RESERVATION_OPEN)', () => {
  it('reports nothing when every reserve is lifted', () => {
    const r = auditInstallReserves([rv('r-1', true), rv('r-2', true)]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('warns per open reserve, naming the support', () => {
    const r = auditInstallReserves([rv('r-1', false, 's-42')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('INSTALL.RESERVATION_OPEN');
    expect(r.warnings[0]?.severity).toBe('warning');
    expect(r.warnings[0]?.ruleRef).toBe('H6.2');
    expect(r.warnings[0]?.entity).toEqual({ kind: 'install_reserve', id: 'r-1' });
    expect(r.warnings[0]?.params['support_id']).toBe('s-42');
  });

  it('reports open reserves sorted by id, ignoring lifted ones', () => {
    const r = auditInstallReserves([
      rv('r-c', false),
      rv('r-a', true),
      rv('r-b', false),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['r-b', 'r-c']);
  });

  it('is a no-op for an empty list', () => {
    const r = auditInstallReserves([]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });
});
