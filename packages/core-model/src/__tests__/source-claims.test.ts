import { describe, it, expect } from 'vitest';
import { detectDiscrepancies, markIfOpen } from '../source-claims.js';
import type { SourceClaim } from '../source-claims.js';

/** Le cas du complément : la charte dit trois niveaux, les plans en montrent deux. */
const NIVEAUX: SourceClaim[] = [
  { key: 'niveaux_parking', source: 'Charte', value: '3', recorded_on: '2026-01-10' },
  { key: 'niveaux_parking', source: 'Plans architecte', value: '2', recorded_on: '2026-05-04' },
];

describe('detectDiscrepancies (M16)', () => {
  it('ne voit pas d’écart quand les sources s’accordent', () => {
    const accord: SourceClaim[] = [
      { key: 'parking_gratuit', source: 'Charte', value: 'oui', recorded_on: '2026-01-10' },
      { key: 'parking_gratuit', source: 'Relevé', value: 'oui', recorded_on: '2026-05-04' },
    ];
    expect(detectDiscrepancies(accord)).toEqual([]);
  });

  it('voit l’écart et garde les deux affirmations', () => {
    const [écart] = detectDiscrepancies(NIVEAUX);
    expect(écart?.key).toBe('niveaux_parking');
    expect(écart?.claims).toHaveLength(2);
    expect(écart?.open).toBe(true);
    expect(écart?.decision).toBeNull();
  });

  it('retient la plus récente, pas la plus répandue', () => {
    // Trois documents anciens répétant la même valeur ne l'emportent pas sur un
    // relevé postérieur : le vote majoritaire confondrait diffusion et véracité.
    const repandue: SourceClaim[] = [
      { key: 'capacite', source: 'Plaquette', value: '100', recorded_on: '2025-02-01' },
      { key: 'capacite', source: 'Plan commercial', value: '100', recorded_on: '2025-03-01' },
      { key: 'capacite', source: 'Dossier bailleur', value: '100', recorded_on: '2025-04-01' },
      { key: 'capacite', source: 'Relevé sur site', value: '93', recorded_on: '2026-06-01' },
    ];
    const [écart] = detectDiscrepancies(repandue);
    expect(écart?.retained_value).toBe('93');
    expect(écart?.retained_source).toBe('Relevé sur site');
  });

  it('une valeur retenue provisoire sort marquée', () => {
    const [écart] = detectDiscrepancies(NIVEAUX);
    expect(écart).toBeDefined();
    if (écart === undefined) return;
    expect(markIfOpen(écart, 'à confirmer')).toBe('2 (à confirmer)');
  });

  it('une décision clôt l’écart et retient sa source', () => {
    const [écart] = detectDiscrepancies(NIVEAUX, {
      niveaux_parking: { source: 'Charte', decided_by: 'Direction', decided_on: '2026-07-01' },
    });
    expect(écart?.open).toBe(false);
    expect(écart?.retained_value).toBe('3');
    expect(écart?.decision?.decided_by).toBe('Direction');
  });

  it('une valeur décidée sort nue, sans mention', () => {
    const [écart] = detectDiscrepancies(NIVEAUX, {
      niveaux_parking: { source: 'Charte', decided_by: 'Direction', decided_on: '2026-07-01' },
    });
    expect(écart).toBeDefined();
    if (écart === undefined) return;
    expect(markIfOpen(écart, 'à confirmer')).toBe('3');
  });

  it('ignore une décision qui désigne une source disparue', () => {
    // La décision a tranché sur un état révolu. La suivre retiendrait une valeur
    // que plus aucune source ne porte ; l'écart doit rouvrir.
    const [écart] = detectDiscrepancies(NIVEAUX, {
      niveaux_parking: { source: 'Note de 2019', decided_by: 'Direction', decided_on: '2026-07-01' },
    });
    expect(écart?.open).toBe(true);
    expect(écart?.retained_source).toBe('Plans architecte');
  });

  it('départage deux affirmations de même date par leur source, de façon stable', () => {
    const memeJour: SourceClaim[] = [
      { key: 'ouverture', source: 'Zeta', value: 'mars', recorded_on: '2026-04-01' },
      { key: 'ouverture', source: 'Alpha', value: 'avril', recorded_on: '2026-04-01' },
    ];
    const first = detectDiscrepancies(memeJour);
    const second = detectDiscrepancies([...memeJour].reverse());
    expect(first[0]?.retained_source).toBe('Alpha');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('rend les écarts par clé, et leurs affirmations par source', () => {
    const melange: SourceClaim[] = [
      ...NIVEAUX,
      { key: 'capacite', source: 'Relevé', value: '93', recorded_on: '2026-06-01' },
      { key: 'capacite', source: 'Plan', value: '100', recorded_on: '2025-03-01' },
    ];
    const écarts = detectDiscrepancies(melange);
    expect(écarts.map((e) => e.key)).toEqual(['capacite', 'niveaux_parking']);
    expect(écarts[0]?.claims.map((c) => c.source)).toEqual(['Plan', 'Relevé']);
  });

  it('une source qui parle seule ne fait pas un écart', () => {
    const seule: SourceClaim[] = [
      { key: 'ouverture', source: 'Charte', value: 'mars', recorded_on: '2026-01-01' },
    ];
    expect(detectDiscrepancies(seule)).toEqual([]);
  });
});
