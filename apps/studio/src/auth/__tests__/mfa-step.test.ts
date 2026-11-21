import { describe, it, expect } from 'vitest';
import { mfaStep, qrImageSource, totpCode } from '../mfa-step.js';

describe('AUTH.6 — l’étape du second facteur', () => {
  it('n’en demande pas aux rôles que A6.3 ne tient pas', () => {
    for (const actor of ['designer', 'operator', 'auditor', 'vendor', 'marketing'] as const) {
      expect(mfaStep({ actor, currentLevel: 'aal1', verifiedFactors: 0 })).toBe('none');
    }
  });

  it('demande l’enrôlement à un admin ou un owner_rep sans facteur, la vérification sinon', () => {
    expect(mfaStep({ actor: 'admin', currentLevel: 'aal1', verifiedFactors: 0 })).toBe('enroll');
    expect(mfaStep({ actor: 'owner_rep', currentLevel: 'aal1', verifiedFactors: 1 })).toBe('verify');
    expect(mfaStep({ actor: 'admin', currentLevel: null, verifiedFactors: 0 })).toBe('enroll');
  });

  it('ne demande plus rien une fois le facteur vérifié dans la session', () => {
    expect(mfaStep({ actor: 'admin', currentLevel: 'aal2', verifiedFactors: 1 })).toBe('none');
  });
});

describe('AUTH.6 — la saisie du code', () => {
  it('accepte six chiffres, espaces de saisie retirés', () => {
    expect(totpCode('123 456')).toBe('123456');
    expect(totpCode(' 654321 ')).toBe('654321');
  });

  it('refuse tout le reste', () => {
    for (const raw of ['', '12345', '1234567', '12a456', '١٢٣٤٥٦']) expect(totpCode(raw)).toBeNull();
  });
});

describe('AUTH.6 — l’image du code QR', () => {
  it('garde une adresse data SVG, enveloppe un balisage SVG, écarte le reste', () => {
    expect(qrImageSource('data:image/svg+xml;utf-8,<svg/>')).toBe('data:image/svg+xml;utf-8,<svg/>');
    expect(qrImageSource('<svg xmlns="http://www.w3.org/2000/svg"/>'))
      .toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>')}`);
    expect(qrImageSource('javascript:alert(1)')).toBeNull();
    expect(qrImageSource('https://ailleurs.invalid/qr.png')).toBeNull();
  });
});
