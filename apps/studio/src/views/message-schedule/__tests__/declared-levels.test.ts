import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { declaredInformationLevels } from '../schedule-model.js';

describe('H2.3 — niveaux d’information déclarés, lus dans le registre', () => {
  const firstKey = refMultilevel.support_types[0]?.key ?? '';

  it('ne donne aucun niveau à une typologie sans déclaration', () => {
    const declared = declaredInformationLevels(refMultilevel);
    expect(declared.every(d => d.levels.length === 0)).toBe(true);
  });

  it('reprend les niveaux déclarés pour la typologie, triés', () => {
    const declared = declaredInformationLevels(refMultilevel, [
      { typology_key: firstKey, level: 3 },
      { typology_key: firstKey, level: 1 },
      { typology_key: 'typologie-d-un-autre-site', level: 2 },
    ]);
    expect(declared.find(d => d.support_type_key === firstKey)?.levels).toEqual([1, 3]);
    expect(declared.some(d => d.support_type_key === 'typologie-d-un-autre-site')).toBe(false);
  });
});
