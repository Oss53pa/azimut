import { describe, it, expect } from 'vitest';
import { contentSecurityPolicy } from '../content-security-policy.js';

/**
 * Audit, lot 7 — la politique de sécurité du contenu du studio construit.
 */
describe('Audit, lot 7 — politique de sécurité du contenu', () => {
  it('aucun script en ligne ni évaluation de code', () => {
    const policy = contentSecurityPolicy(undefined);
    expect(policy).toContain("script-src 'self'");
    expect(policy).not.toContain("'unsafe-eval'");
    const script = /script-src ([^;]*)/.exec(policy)?.[1] ?? '';
    expect(script).not.toContain('unsafe-inline');
    expect(policy).toContain("object-src 'none'");
  });

  it('l’API de données est la seule origine jointe, réduite à son origine', () => {
    const policy = contentSecurityPolicy('https://api.exemple.invalide/rest/v1');
    expect(policy).toContain("connect-src 'self' https://api.exemple.invalide;");
    expect(contentSecurityPolicy('')).toContain("connect-src 'self';");
  });

  it('une API hors https est refusée à la construction', () => {
    expect(() => contentSecurityPolicy('http://api.exemple.invalide')).toThrow(/https/);
  });

  it('même entrée, même politique (INV-4)', () => {
    expect(contentSecurityPolicy('https://a.invalide')).toBe(contentSecurityPolicy('https://a.invalide'));
  });
});
