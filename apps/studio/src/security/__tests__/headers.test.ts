import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  connectOrigins, contentSecurityPolicy, headersFile, hostHeaders, metaContentSecurityPolicy, securityHeaders,
} from '../headers.js';
import { headersDocumentation } from '../headers-doc.js';

/** Lot 7 de l'audit (D-8, D-9) : les en-têtes de sécurité du studio. */
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..', '..');
const STUDIO = resolve(ROOT, 'apps', 'studio');

const directive = (policy: string, name: string): string | undefined =>
  policy.split('; ').find(d => d === name || d.startsWith(`${name} `));

describe('lot 7 : la politique de sécurité du contenu', () => {
  const csp = contentSecurityPolicy(['https://abc.example.test']);

  it('les scripts ne viennent que du site, sans exécution en ligne ni évaluation', () => {
    expect(directive(csp, 'script-src')).toBe("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'font-src')).toBe("font-src 'self'");
  });

  it('connect-src ne nomme que les origines déclarées, en https', () => {
    expect(connectOrigins({
      VITE_AZIMUT_API_URL: 'https://abc.example.test/rest/v1',
      VITE_AZIMUT_AUTH_URL: 'https://abc.example.test/auth/v1',
    })).toEqual(['https://abc.example.test']);
    expect(connectOrigins({ VITE_AZIMUT_API_URL: 'http://abc.example.test/rest/v1' })).toEqual([]);
    expect(connectOrigins({ VITE_AZIMUT_API_URL: 'pas une adresse' })).toEqual([]);
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https://abc.example.test");
  });

  it('l’en-tête interdit l’encadrement ; la balise meta, qui ne le peut pas, n’en dit rien', () => {
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(metaContentSecurityPolicy([]), 'frame-ancestors')).toBeUndefined();
  });

  it('les autres en-têtes : transport strict, type, référent, encadrement, permissions', () => {
    const headers = securityHeaders([]);
    expect(headers['Strict-Transport-Security']).toMatch(/^max-age=\d{8}; includeSubDomains$/);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('le fichier _headers couvre toutes les adresses', () => {
    const file = headersFile(securityHeaders([]));
    expect(file.split('\n')[0]).toBe('/*');
    expect(file).toContain(`  Content-Security-Policy: ${contentSecurityPolicy([])}`);
  });
});

describe('lot 7 : les déclinaisons suivent la source unique', () => {
  it('vercel.json porte les en-têtes de l’hébergeur, et ses réglages de déploiement restent', () => {
    const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
      git: unknown; headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    expect(vercel.git).toEqual({ deploymentEnabled: { '**': false, master: true } });
    expect(vercel.headers).toEqual([{
      source: '/(.*)',
      headers: Object.entries(hostHeaders()).map(([key, value]) => ({ key, value })),
    }]);
  });

  it('la politique de l’hébergeur ne contraint pas ce que seule la page connaît', () => {
    const host = hostHeaders()['Content-Security-Policy'] ?? '';
    expect(directive(host, 'default-src')).toBeUndefined();
    expect(directive(host, 'connect-src')).toBeUndefined();
    expect(directive(host, 'script-src')).toBe("script-src 'self'");
  });

  it('la documentation est celle que la source produit', () => {
    const path = resolve(ROOT, 'docs', 'en-tetes-http.md');
    if (process.env['AZIMUT_WRITE_HEADERS_DOC'] === '1') writeFileSync(path, headersDocumentation());
    expect(readFileSync(path, 'utf8')).toBe(headersDocumentation());
  });
});

describe('lot 7 : aucune ressource tierce dans la page (D-9)', () => {
  it('index.html ne joint aucune autre origine', () => {
    const html = readFileSync(resolve(STUDIO, 'index.html'), 'utf8');
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('les feuilles de style du thème ne chargent que des fichiers du paquet', () => {
    const css = readFileSync(resolve(ROOT, 'packages', 'design-tokens', 'src', 'studio-theme.css'), 'utf8');
    const urls = [...css.matchAll(/url\(["']?([^"')]+)/g)].map(m => m[1] ?? '');
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter(u => !u.startsWith('./fonts/'))).toEqual([]);
  });
});
