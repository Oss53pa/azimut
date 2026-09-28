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

const codes = (draft: LegalEntityDraft, env = ENV): readonly string[] => {
  const checked = validateLegalEntityDraft(draft, env);
  return [...checked.findings.map(f => f.code), ...checked.notices.map(n => n.key)];
};

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
    expect(out.notices).toEqual([]);
  });

  it('porte les numéros facultatifs quand ils sont saisis, sans leurs espaces de bord', () => {
    const out = declareLegalEntityCommand({ ...DRAFT, registrationRef: ' RCCM-1 ', taxRef: 'NCC-2' }, ENV);
    if (!out.ok) throw new Error('refusé');
    expect(out.value.after).toMatchObject({ registration_ref: 'RCCM-1', tax_ref: 'NCC-2' });
  });

  it('refuse une raison sociale vide, par le code du catalogue', () => {
    expect(codes({ ...DRAFT, legalName: '   ' })).toEqual(['DATA.NAME_REQUIRED']);
  });

  it('refuse un pays absent du référentiel', () => {
    expect(codes({ ...DRAFT, countryCode: 'ZZ' })).toEqual(['DATA.COUNTRY_REQUIRED']);
    expect(codes({ ...DRAFT, countryCode: '' })).toEqual(['DATA.COUNTRY_REQUIRED']);
  });

  it('refuse une devise hors du format à trois majuscules, sans code au catalogue', () => {
    expect(codes({ ...DRAFT, currencyCode: '' })).toEqual(['form.currency.invalid']);
    expect(codes({ ...DRAFT, currencyCode: 'xof' })).toEqual(['form.currency.invalid']);
    expect(codes({ ...DRAFT, currencyCode: 'EURO' })).toEqual(['form.currency.invalid']);
  });

  it('rend toutes les anomalies ensemble', () => {
    expect(codes({ ...DRAFT, legalName: '', countryCode: '', currencyCode: '' })).toEqual([
      'DATA.NAME_REQUIRED', 'DATA.COUNTRY_REQUIRED', 'form.currency.invalid',
    ]);
  });

  it('refuse une raison sociale déjà portée, casse et bords ignorés (DATA.NAME_DUPLICATE, bloquant)', () => {
    const out = declareLegalEntityCommand(DRAFT, { ...ENV, existingNames: ['SOCIÉTÉ D’ESSAI'] });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.findings.map(f => [f.code, f.severity])).toEqual([['DATA.NAME_DUPLICATE', 'blocking']]);
  });
});
