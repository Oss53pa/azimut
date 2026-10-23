// Lot 1 de l'audit (A6.3, A2.4) : la détection de secrets, sans dépendance.
//
// Un seul module pour trois usages : l'essai du dépôt
// (`tests/a6-3-no-secret-in-repo.test.ts`), le contrôle de la chaîne sur tous
// les fichiers suivis (`node scripts/secret-scan.mjs`), et celui des livrables
// construits (`node scripts/secret-scan.mjs --dist <répertoire>…`).
//
// Chaque motif cherche une forme précise de secret. Un motif trop large
// noierait la chaîne d'alertes qu'on finirait par ignorer ; un motif absent
// laisserait passer la forme qu'il aurait vue.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

/** Un jeton signé : trois segments base64url, les deux premiers en JSON. */
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

/** Formes de clés reconnaissables à leur préfixe. */
const PREFIXED = [
  { name: 'clé secrète du service de base', re: /\bsb_secret_[A-Za-z0-9_-]{16,}/g },
  { name: 'clé publiable du service de base', re: /\bsb_publishable_[A-Za-z0-9_-]{16,}/g },
  { name: 'clé de paiement', re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { name: 'clé d’accès cloud', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'jeton de forge', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g },
  { name: 'jeton de messagerie', re: /\bxox[abpr]-[A-Za-z0-9-]{20,}/g },
  { name: 'clé privée', re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g },
];

/** `://identifiant:mot-de-passe@hôte`, hors marqueur et interpolation. */
const URI_WITH_PASSWORD = /[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9_.-]+:([^@\s'"`$<{]+)@/g;

/** Un nom qui annonce un secret, affecté à un littéral (source seulement). */
const ASSIGNED_SECRET =
  /\b([A-Za-z_][A-Za-z0-9_]*(?:SECRET|PASSWORD|PASSWD|_TOKEN|_API_KEY|PRIVATE_KEY))\b\s*[:=]\s*(['"`])([^'"`\n]+)\2/g;

/** Ce qu'un littéral peut valoir sans être un secret. */
export function isPlaceholder(value) {
  const trimmed = value.trim();
  return trimmed === ''
    || /^[<{]/.test(trimmed)
    || trimmed.includes('${')
    // Une substitution de shell : `$(openssl rand -hex 32)`, `$VARIABLE`.
    || /^\$[({A-Z_]/.test(trimmed)
    || trimmed.startsWith('process.env')
    || trimmed.startsWith('secrets.')
    || /^[A-Z][A-Z0-9_]*$/.test(trimmed);
}

/**
 * Valeurs tolérées dans le dépôt, et la raison, vérifiée et non supposée.
 *
 * La tolérance porte sur la valeur, jamais sur le fichier : déclarer un
 * fichier le rendrait aveugle à tout secret qu'on y ajouterait ensuite.
 * Aucune n'authentifie quoi que ce soit.
 */
export const DECLARED = new Map([
  ['motdepasse', 'Contre-exemple : la chaîne de connexion que les contrôles doivent reconnaître.'],
  ['valeur-en-clair', 'Contre-exemple : le secret affecté que le contrôle doit reconnaître.'],
  ['clef', 'Fixture de `createRepository` : le mot « clef », qui éprouve qu’une clé présente bascule '
    + 'le dépôt du jeu de référence vers le dépôt réel. Elle n’ouvre rien.'],
]);

/** Le rôle porté par un jeton, ou null s'il ne se lit pas. */
export function jwtRole(token) {
  const payload = token.split('.')[1] ?? '';
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof json?.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/**
 * Les secrets d'un texte.
 *
 * `allowed` : les valeurs admises, chacune avec sa raison. `mode` : `source`
 * cherche aussi les affectations de littéraux à un nom de secret ; `dist`
 * admet en outre un jeton de rôle `anon` s'il est la clé configurée.
 */
export function findSecrets(text, { allowed = new Set(), mode = 'source' } = {}) {
  const hits = [];
  for (const m of text.matchAll(JWT)) {
    if (allowed.has(m[0])) continue;
    const role = jwtRole(m[0]);
    hits.push(`jeton signé (rôle ${role ?? 'illisible'})`);
  }
  for (const { name, re } of PREFIXED) {
    for (const m of text.matchAll(re)) {
      if (!allowed.has(m[0])) hits.push(name);
    }
  }
  for (const m of text.matchAll(URI_WITH_PASSWORD)) {
    const password = m[1] ?? '';
    if (!isPlaceholder(password) && !allowed.has(password)) hits.push('chaîne de connexion avec mot de passe');
  }
  if (mode === 'source') {
    for (const m of text.matchAll(ASSIGNED_SECRET)) {
      const value = m[3] ?? '';
      if (!isPlaceholder(value) && !allowed.has(value)) hits.push(`${m[1] ?? ''} affecté à un littéral`);
    }
  }
  return hits;
}

/** Un texte qui est, en entier, un jeton signé. Sans drapeau global : sans état. */
const WHOLE_JWT = /^eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

/**
 * Le contrôle d'un livrable : la seule clé admise est la clé publiable
 * configurée, et elle doit être de rôle `anon` si c'est un jeton. Rend les
 * lignes d'erreur, vides si le livrable est propre.
 */
export function checkDist(files, publishable) {
  const key = publishable.trim();
  if (key !== '' && WHOLE_JWT.test(key) && jwtRole(key) !== 'anon') {
    return ['La clé configurée pour le livrable n’est pas une clé publiable (rôle autre que anon).'];
  }
  const allowed = new Set(key === '' ? [] : [key]);
  return files.flatMap(({ path, text }) =>
    findSecrets(text, { allowed, mode: 'dist' }).map(what => `${path} : ${what}`));
}

/** Les fichiers suivis par git, lus comme texte ; un fichier binaire est écarté. */
export function trackedTextFiles(root) {
  const list = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const out = [];
  for (const path of list) {
    const full = resolve(root, path);
    let body;
    try { body = readFileSync(full); } catch { continue; }
    if (body.includes(0)) continue;
    out.push({ path, text: body.toString('utf8') });
  }
  return out;
}

/** Les fichiers d'un répertoire construit, récursivement. */
export function distTextFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...distTextFiles(full));
    else {
      const body = readFileSync(full);
      if (!body.includes(0)) out.push({ path: relative(process.cwd(), full), text: body.toString('utf8') });
    }
  }
  return out;
}

function main(argv) {
  const root = process.cwd();
  const distIndex = argv.indexOf('--dist');
  let errors;
  let count;
  if (distIndex === -1) {
    const files = trackedTextFiles(root);
    const allowed = new Set(DECLARED.keys());
    errors = files.flatMap(({ path, text }) => findSecrets(text, { allowed }).map(what => `${path} : ${what}`));
    count = files.length;
  } else {
    // Un livrable nommé mais non construit est écarté ; aucun livrable du
    // tout est une erreur, sans quoi le contrôle passerait sans rien lire.
    const dirs = argv.slice(distIndex + 1).filter(d => existsSync(resolve(root, d)));
    if (dirs.length === 0) {
      console.error('Aucun livrable construit à inspecter.');
      return 1;
    }
    const files = dirs.flatMap(d => distTextFiles(resolve(root, d)));
    errors = checkDist(files, process.env.VITE_AZIMUT_API_KEY ?? '');
    count = files.length;
  }
  for (const line of errors) console.error(line);
  if (errors.length > 0) {
    console.error(`${errors.length} secret(s) trouvé(s). A6.3 : aucun secret dans le dépôt ni dans un livrable.`);
    return 1;
  }
  console.log(`${count} fichier(s) inspecté(s), aucun secret.`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
