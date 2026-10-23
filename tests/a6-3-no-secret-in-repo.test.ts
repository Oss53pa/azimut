import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DECLARED, checkDist, findSecrets, isPlaceholder, jwtRole, trackedTextFiles,
} from '../scripts/secret-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * A6.3 et A2.4 : aucun secret dans le dépôt.
 *
 * « Aucun secret dans le dépôt, variables d'environnement uniquement, fichier
 * d'exemple sans valeur réelle », et parmi les interdictions permanentes :
 * « Committer un secret, une clé, une chaîne de connexion, un jeton. »
 *
 * Deux secrets y ont vécu, tous deux dans le banc d'essai d'étanchéité : un
 * secret de signature de jetons écrit en clair, et un mot de passe de rôle
 * injecté dans une chaîne de connexion. Le lot 1 de l'audit étend le contrôle
 * à tous les fichiers suivis par git, documentation et configuration
 * comprises, et aux formes de clés reconnaissables à leur préfixe : jetons
 * signés, clés du service de base, de paiement, d'accès cloud, de forge, clés
 * privées. Le même module sert à la chaîne (`node scripts/secret-scan.mjs`)
 * et au contrôle des livrables construits (`--dist`).
 */
const files = trackedTextFiles(ROOT);

describe('A6.3 : aucun secret dans le dépôt', () => {
  it('le balayage lit tous les fichiers suivis, documentation et configuration comprises', () => {
    expect(files.length).toBeGreaterThan(1000);
    for (const kind of ['.md', '.toml', '.example', '.yml', '.sql']) {
      expect(files.some(f => f.path.endsWith(kind)), kind).toBe(true);
    }
  });

  it('aucun secret, quelle que soit sa forme', () => {
    const hits = files.flatMap(f =>
      findSecrets(f.text, { allowed: new Set(DECLARED.keys()) }).map(what => `${f.path} : ${what}`));
    expect(
      hits,
      'A6.3 : « Aucun secret dans le dépôt, variables d’environnement '
      + 'uniquement, fichier d’exemple sans valeur réelle. » A2.4 : « Committer '
      + 'un secret, une clé, une chaîne de connexion, un jeton. »\n'
      + 'Passez par une variable d’environnement, sans valeur de repli.',
    ).toEqual([]);
  });

  it('chaque tolérance porte une raison qui dit quelque chose', () => {
    const thin = [...DECLARED].filter(([, why]) => why.trim().length < 40).map(([value]) => value);
    expect(thin, `Raisons trop courtes :\n${thin.join('\n')}`).toHaveLength(0);
  });
});

/**
 * L'essai d'abus : des secrets factices, assemblés à l'exécution pour que le
 * fichier lui-même n'en contienne aucun, sont tous reconnus. Sans lui, un
 * motif devenu inopérant passerait pour un dépôt propre.
 */
describe('lot 1 : le contrôle reconnaît chaque forme de secret', () => {
  const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = (role: string): string => [b64({ alg: 'HS256' }), b64({ role, iss: 'essai' }), 'c2lnbmF0dXJlZXNzYWk'].join('.');
  const filler = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0';

  it.each([
    ['un jeton de rôle service', jwt('service_role'), 'jeton signé (rôle service_role)'],
    ['une clé secrète du service de base', `sb_${'secret'}_${filler}`, 'clé secrète du service de base'],
    ['une clé de paiement', `sk_${'live'}_${filler}`, 'clé de paiement'],
    ['une clé d’accès cloud', `AKIA${'ABCDEFGHIJKLMNOP'}`, 'clé d’accès cloud'],
    ['un jeton de forge', `ghp_${filler}`, 'jeton de forge'],
    ['une clé privée', `-----BEGIN ${'PRIVATE'} KEY-----`, 'clé privée'],
    ['une chaîne de connexion', `postgres://azimut:${'s3cr3t'}@hote/azimut`, 'chaîne de connexion avec mot de passe'],
    ['un secret affecté', `const API_${'TOKEN'} = 'x9y8z7';`, 'API_TOKEN affecté à un littéral'],
  ])('reconnaît %s', (_label, text, expected) => {
    expect(findSecrets(`avant ${text} après`)).toEqual([expected]);
  });

  it('lit le rôle d’un jeton, et admet dans un livrable la seule clé déclarée', () => {
    expect(jwtRole(jwt('anon'))).toBe('anon');
    const key = jwt('anon');
    expect(findSecrets(`const k="${key}"`, { allowed: new Set([key]), mode: 'dist' })).toEqual([]);
    expect(findSecrets(`const k="${jwt('anon')}x"`, { allowed: new Set([key]), mode: 'dist' })).toHaveLength(1);
  });

  it('dans un livrable, voit un jeton de service planté à côté de la clé publiable', () => {
    const key = jwt('anon');
    const bundle = [{ path: 'dist/a.js', text: `const k="${key}";` }, { path: 'dist/b.js', text: `x="${jwt('service_role')}"` }];
    expect(checkDist(bundle, key)).toEqual(['dist/b.js : jeton signé (rôle service_role)']);
    // Le contrôle ne garde aucun état d'un appel à l'autre.
    expect(checkDist(bundle, key)).toHaveLength(1);
    expect(checkDist([bundle[0] ?? { path: '', text: '' }], key)).toEqual([]);
  });

  it('refuse un livrable dont la clé configurée n’est pas publiable', () => {
    expect(checkDist([], jwt('service_role'))[0]).toMatch(/pas une clé publiable/);
  });

  it('laisse passer un marqueur, une interpolation, une substitution et une lecture d’environnement', () => {
    for (const value of ['', '<mot-de-passe>', '${SECRET}', '$(openssl rand -hex 32)', 'process.env.X', 'AZIMUT_TEST_JWT_SECRET']) {
      expect(isPlaceholder(value), value).toBe(true);
    }
  });
});

/**
 * Lot 1 : seules l'URL du service et la clé publiable entrent dans le studio,
 * plus le nom de schéma que D-1 y admet ; et chaque variable lue par le code
 * figure, sans valeur, dans le fichier d'exemple.
 */
describe('lot 1 : les variables d’environnement', () => {
  const STUDIO_ALLOWED = new Set([
    'VITE_AZIMUT_API_URL', 'VITE_AZIMUT_API_KEY', 'VITE_AZIMUT_AUTH_URL', 'VITE_AZIMUT_DB_SCHEMA',
  ]);
  const NAME = /\b((?:VITE|AZIMUT)_[A-Z0-9_]+|DATABASE_URL|CHROMIUM_PATH)\b/g;
  const code = files.filter(f => /^(apps|packages|scripts)\/.*\.(ts|tsx|js|mjs)$/.test(f.path)
    || f.path === 'playwright.config.ts');
  const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');

  it('le studio ne lit que les variables admises en VITE_', () => {
    const read = new Set(code.filter(f => f.path.startsWith('apps/studio/'))
      .flatMap(f => [...f.text.matchAll(/\bVITE_[A-Z0-9_]+\b/g)].map(m => m[0])));
    expect([...read].filter(n => !STUDIO_ALLOWED.has(n)).sort()).toEqual([]);
  });

  it('chaque variable lue par le code figure au fichier d’exemple', () => {
    const declared = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]));
    const read = new Set(code.flatMap(f => [...f.text.matchAll(NAME)].map(m => m[1] ?? '')));
    const missing = [...read].filter(n => !declared.has(n) && !n.endsWith('_')).sort();
    expect(missing).toEqual([]);
  });

  it('le fichier d’exemple ne porte aucune valeur réelle', () => {
    const values = [...example.matchAll(/^[A-Z][A-Z0-9_]*=(.*)$/gm)].map(m => (m[1] ?? '').trim());
    const real = values.filter(v => v !== '' && !/^(azimut|local)$/.test(v) && !/<[a-z-]+>/.test(v));
    expect(real).toEqual([]);
  });
});
