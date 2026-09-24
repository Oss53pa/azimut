import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * A6.3 et A2.4 — aucun secret dans le dépôt.
 *
 * « Aucun secret dans le dépôt, variables d'environnement uniquement, fichier
 * d'exemple sans valeur réelle », et parmi les interdictions permanentes :
 * « Committer un secret, une clé, une chaîne de connexion, un jeton. »
 *
 * Deux secrets y ont vécu, tous deux dans le banc d'essai d'étanchéité : un
 * secret de signature de jetons écrit en clair, et un mot de passe de rôle
 * injecté dans une chaîne de connexion. Tous deux ont été défendus par le même
 * argument — ils sont jetables, ils ne servent qu'aux essais — et l'argument
 * ne tient pas : la règle ne distingue pas les secrets selon leur portée, et
 * c'est ainsi qu'un secret d'essai finit par servir ailleurs.
 *
 * Ce contrôle est ce qui manquait. Il lit le dépôt comme du texte, sans
 * l'exécuter, et cherche les deux formes exactes qui y sont passées.
 */

/** Ce qui n'est pas du texte source, ou que le dépôt ne porte pas. */
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', 'test-results', 'playwright-report', 'coverage',
]);

const SCANNED = /\.(ts|tsx|js|mjs|cjs|json|ya?ml|sql|sh)$/;

/**
 * Une chaîne de connexion portant un mot de passe en clair.
 *
 * Le motif cherche `://identifiant:quelque-chose@hôte`. Il ignore ce qui n'est
 * pas une valeur : un marqueur entre chevrons, une interpolation de modèle,
 * une lecture de variable d'environnement.
 */
const URI_WITH_PASSWORD = /[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9_.-]+:([^@\s'"`$<{]+)@/g;

/**
 * Une constante dont le nom annonce un secret, affectée à un littéral.
 *
 * Une affectation de la forme « nom finissant par SECRET, égale, littéral »,
 * et ses variantes en clé d’objet ou en variable de fichier de chaînes. Une
 * affectation vide, un marqueur ou une lecture d’environnement passent.
 */
const ASSIGNED_SECRET =
  /\b([A-Za-z_][A-Za-z0-9_]*(?:SECRET|PASSWORD|PASSWD|_TOKEN|_API_KEY|PRIVATE_KEY))\b\s*[:=]\s*(['"`])([^'"`\n]+)\2/g;

/** Ce qu'un littéral peut valoir sans être un secret. */
function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === ''
    // Un marqueur à remplacer : `<mot-de-passe>`, `{{ secret }}`, `…`.
    || /^[<{]/.test(trimmed)
    || trimmed.includes('${')
    // Une lecture d'environnement, ou une référence de la chaîne d'intégration.
    || trimmed.startsWith('process.env')
    || trimmed.startsWith('secrets.')
    // Un nom de variable annoncé, non sa valeur.
    || /^[A-Z][A-Z0-9_]*$/.test(trimmed);
}

/**
 * Valeurs tolérées, et la raison — vérifiée, pas supposée.
 *
 * La tolérance porte sur la **valeur**, jamais sur le fichier : déclarer un
 * fichier le rendrait aveugle à tout secret qu'on y ajouterait ensuite.
 *
 * Aucune des trois n'authentifie quoi que ce soit. Deux sont les
 * contre-exemples de ce contrôle, qui doit reconnaître ce qu'il cherche ; la
 * troisième est le mot « clef », que `createRepository` reçoit pour éprouver
 * qu'une clé présente bascule le dépôt.
 */
const DECLARED: Readonly<Record<string, string>> = {
  motdepasse:
    'Contre-exemple de ce contrôle : la chaîne de connexion qu’il doit reconnaître.',
  'valeur-en-clair':
    'Contre-exemple de ce contrôle : le secret affecté qu’il doit reconnaître.',
  clef:
    'Fixture de `createRepository` : le mot « clef », qui éprouve qu’une clé présente '
    + 'bascule le dépôt du jeu de référence vers le dépôt réel. Elle n’ouvre rien.',
};

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (SCANNED.test(entry)) out.push(full);
  }
  return out;
}

type Hit = { readonly where: string; readonly what: string };

function scan(): readonly Hit[] {
  const hits: Hit[] = [];
  for (const file of sources(ROOT)) {
    const where = relative(ROOT, file);
    const body = readFileSync(file, 'utf-8');

    for (const m of body.matchAll(URI_WITH_PASSWORD)) {
      const password = m[1] ?? '';
      if (isPlaceholder(password) || password in DECLARED) continue;
      hits.push({ where, what: `chaîne de connexion avec mot de passe : ${m[0]}` });
    }
    for (const m of body.matchAll(ASSIGNED_SECRET)) {
      const value = m[3] ?? '';
      if (isPlaceholder(value) || value in DECLARED) continue;
      hits.push({ where, what: `${m[1] ?? ''} affecté à un littéral` });
    }
  }
  return hits;
}

describe('A6.3 — aucun secret dans le dépôt', () => {
  const hits = scan();

  it('le balayage lit quelque chose, sans quoi il ne prouverait rien', () => {
    expect(sources(ROOT).length).toBeGreaterThan(200);
  });

  it('aucune chaîne de connexion ni secret affecté en clair', () => {
    expect(
      hits.map(h => `${h.where} — ${h.what}`),
      'A6.3 : « Aucun secret dans le dépôt, variables d’environnement '
      + 'uniquement, fichier d’exemple sans valeur réelle. » A2.4 : « Committer '
      + 'un secret, une clé, une chaîne de connexion, un jeton. »\n'
      + 'Passez par une variable d’environnement, sans valeur de repli.',
    ).toEqual([]);
  });

  /**
   * Le contre-exemple : le contrôle reconnaît ce qu'il cherche. Sans lui, un
   * motif devenu inopérant passerait pour un dépôt propre.
   */
  it('reconnaît les deux formes qu’il cherche', () => {
    const uri = [...'postgres://authenticator:motdepasse@127.0.0.1:5433/azimut'
      .matchAll(URI_WITH_PASSWORD)];
    expect(uri).toHaveLength(1);
    expect(isPlaceholder(uri[0]?.[1] ?? '')).toBe(false);

    const assigned = [..."export const TEST_JWT_SECRET = 'valeur-en-clair';"
      .matchAll(ASSIGNED_SECRET)];
    expect(assigned).toHaveLength(1);
    expect(isPlaceholder(assigned[0]?.[3] ?? '')).toBe(false);
  });

  it('chaque tolérance porte une raison qui dit quelque chose', () => {
    const thin = Object.entries(DECLARED)
      .filter(([, why]) => why.trim().length < 40)
      .map(([value]) => value);
    expect(thin, `Raisons trop courtes :\n${thin.join('\n')}`).toHaveLength(0);
  });

  it('laisse passer un marqueur, une interpolation et une lecture d’environnement', () => {
    for (const value of ['', '<mot-de-passe>', '${SECRET}', 'process.env.X', 'AZIMUT_TEST_JWT_SECRET']) {
      expect(isPlaceholder(value), value).toBe(true);
    }
  });
});
