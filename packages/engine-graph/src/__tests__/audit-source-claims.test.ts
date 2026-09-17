import { describe, it, expect } from 'vitest';
import type { SourceClaim } from '@azimut/core-model';
import { auditSourceClaims } from '../audit-source-claims.js';

const NIVEAUX: SourceClaim[] = [
  { key: 'niveaux_parking', source: 'Charte', value: '3', recorded_on: '2026-01-10' },
  { key: 'niveaux_parking', source: 'Plans architecte', value: '2', recorded_on: '2026-05-04' },
];

describe('auditSourceClaims (M16)', () => {
  it('ne signale rien quand les sources s’accordent', () => {
    const report = auditSourceClaims([
      { key: 'parking_gratuit', source: 'Charte', value: 'oui', recorded_on: '2026-01-10' },
      { key: 'parking_gratuit', source: 'Relevé', value: 'oui', recorded_on: '2026-05-04' },
    ]);
    expect(report.total).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it('signale un écart ouvert sans bloquer', () => {
    const report = auditSourceClaims(NIVEAUX);
    const [finding] = report.findings;
    expect(finding?.code).toBe('LAYOUT.SOURCE_DISCREPANCY_OPEN');
    // Signalant : bloquer arrêterait la production sur une question qui n'a pas
    // de réponse technique. Ce qui est interdit, c'est de se taire.
    expect(finding?.severity).toBe('warning');
    expect(report.open_count).toBe(1);
  });

  it('dit la valeur retenue et les sources en présence', () => {
    const [finding] = auditSourceClaims(NIVEAUX).findings;
    expect(finding?.params['retained_value']).toBe('2');
    expect(finding?.params['retained_source']).toBe('Plans architecte');
    expect(finding?.params['sources']).toBe('Charte, Plans architecte');
    expect(finding?.params['claim_count']).toBe(2);
  });

  it('un écart arbitré reste au registre et ne signale plus', () => {
    const report = auditSourceClaims(NIVEAUX, {
      niveaux_parking: { source: 'Charte', decided_by: 'Direction', decided_on: '2026-07-01' },
    });
    expect(report.total).toBe(1);
    expect(report.open_count).toBe(0);
    expect(report.findings).toEqual([]);
    expect(report.discrepancies[0]?.retained_value).toBe('3');
  });

  it('est déterministe', () => {
    expect(JSON.stringify(auditSourceClaims(NIVEAUX)))
      .toBe(JSON.stringify(auditSourceClaims([...NIVEAUX].reverse())));
  });
});
