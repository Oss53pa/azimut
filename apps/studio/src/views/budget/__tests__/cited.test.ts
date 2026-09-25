import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { CostReference } from '@azimut/core-model';
import { citedTypologies, missingCostFindings } from '../cited.js';

const [support, ...rest] = refMultilevel.supports;
const [type] = refMultilevel.support_types;
if (support === undefined || type === undefined) throw new Error('jeu incomplet');
const typed = { ...refMultilevel, supports: [{ ...support, typology_id: type.id }, ...rest] };

const priced: CostReference = {
  id: 'c', typology_key: type.key, substrate_key: 's', manufacturer_name: null,
  unit_cost: { minor: 100, currency: 'EUR' }, since: null,
};

describe('H8 — typologies citées par les supports du site', () => {
  it('ne cite rien pour des supports sans typologie : rien ne leur en est supposé', () => {
    expect(citedTypologies(refMultilevel)).toEqual([]);
  });

  it('cite la typologie que porte un support', () => {
    expect(citedTypologies(typed)).toEqual([type.key]);
  });

  it('relève une typologie citée sans coût, et se tait quand elle est chiffrée', () => {
    expect(missingCostFindings(typed, []).map(f => f.code)).toEqual(['COST.REFERENCE_MISSING']);
    expect(missingCostFindings(typed, [priced])).toEqual([]);
    expect(missingCostFindings(typed, [{ ...priced, unit_cost: null }])).toHaveLength(1);
  });
});
