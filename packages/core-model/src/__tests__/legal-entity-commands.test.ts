import { describe, expect, it } from 'vitest';
import {
  declareLegalEntityCommand, validateLegalEntityDraft, type LegalEntityDraft, type LegalEntityEnvironment,
} from '../legal-entity-commands.js';

const DRAFT: LegalEntityDraft = {
  legalName: '  Société d’essai  ',
  countryCode: 'CI',
  currencyCode: 'XOF',
  registrationRef: '',
  taxRef: '',
};

const ENV: LegalEntityEnvironment = {
  orgId: 'org-1',
  newId: () => 'le-1',
  timestamp: '2026-09-27T12:00:00.000Z',
  countryCodes: ['CI', 'FR'],
  existingNames: [],
};

const codes = (draft: LegalEntityDraft, env = ENV): readonly string[] =>
  validateLegalEntityDraft(draft, env).blocking.map(f => f.code);

describe('Q5 — déclarer une entité juridique', () => {
  it('rend une commande de création du module 00 sur legal_entity', () => {
    const out = declareLegalEntityCommand(DRAFT, ENV);
    if (!out.ok) throw new Error(out.findings.map(f => f.code).join(', '));
    expect(out.value.module).toBe('00-plateforme');
    expect(out.value.table).toBe('legal_entity');
    expect(out.value.operation).toBe('create');
    expect(out.value.after).toEqual({
      id: 'le-1', org_id: 'org-1', legal_name: 'Société d’essai', country_code: 'CI', currency_code: 'XOF',
    });
    expect(out.warnings).toEqual([]);
  });

  it('porte les numéros facultatifs quand ils sont saisis, sans leurs espaces de bord', () => {
    const out = declareLegalEntityCommand({ ...DRAFT, registrationRef: ' RCCM-1 ', taxRef: 'NCC-2' }, ENV);
    if (!out.ok) throw new Error('refusé');
    expect(out.value.after).toMatchObject({ registration_ref: 'RCCM-1', tax_ref: 'NCC-2' });
  });

  it('refuse une raison sociale vide', () => {
    expect(codes({ ...DRAFT, legalName: '   ' })).toEqual(['DATA.LEGAL_NAME_REQUIRED']);
  });

  it('refuse un pays absent du référentiel', () => {
    expect(codes({ ...DRAFT, countryCode: 'ZZ' })).toEqual(['DATA.COUNTRY_REQUIRED']);
    expect(codes({ ...DRAFT, countryCode: '' })).toEqual(['DATA.COUNTRY_REQUIRED']);
  });

  it('refuse une devise hors du format à trois majuscules', () => {
    expect(codes({ ...DRAFT, currencyCode: '' })).toEqual(['DATA.CURRENCY_INVALID']);
    expect(codes({ ...DRAFT, currencyCode: 'xof' })).toEqual(['DATA.CURRENCY_INVALID']);
    expect(codes({ ...DRAFT, currencyCode: 'EURO' })).toEqual(['DATA.CURRENCY_INVALID']);
  });

  it('rend toutes les anomalies ensemble', () => {
    expect(codes({ ...DRAFT, legalName: '', countryCode: '', currencyCode: '' })).toEqual([
      'DATA.LEGAL_NAME_REQUIRED', 'DATA.COUNTRY_REQUIRED', 'DATA.CURRENCY_INVALID',
    ]);
  });

  it('avertit sans bloquer quand la raison sociale existe déjà, casse et bords ignorés', () => {
    const out = declareLegalEntityCommand(DRAFT, { ...ENV, existingNames: ['SOCIÉTÉ D’ESSAI'] });
    if (!out.ok) throw new Error('refusé');
    expect(out.warnings.map(f => f.code)).toEqual(['DATA.LEGAL_NAME_DUPLICATE']);
  });
});
