import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * Un contrôle écrit, éprouvé, et que rien n'appelle.
 *
 * `error-code-reachability` vérifie qu'un code du catalogue est levé quelque
 * part. Il ne voit pas le cas d'après : la fonction qui le lève existe, ses
 * essais passent, et aucun appelant ne la fait tourner. C'est exactement ce qui
 * est arrivé deux fois — `auditParking` avec `forDeliverable`, puis
 * `verticalLinkMisalignedFindings`, écrit et laissé hors de `validateGraph`
 * par un script d'édition interrompu. La seconde fois, seul un essai
 * d'intégration l'a vu.
 *
 * L'essai exige donc qu'une fonction de contrôle soit citée hors de son propre
 * fichier, ou inscrite ici avec sa raison.
 *
 * **Ce qu'il ne voit pas**, et il vaut mieux le dire que de le laisser croire :
 * la citation suffit, la chaîne d'appel n'est pas suivie. Une fonction appelée
 * par une autre fonction elle-même jamais appelée passerait. Le contrôle est
 * une barrière basse, pas une preuve d'atteignabilité.
 *
 * Les commentaires sont retirés avant de chercher la citation : un nom cité en
 * prose n'est pas un appel, et laisser passer une mention suffirait à rendre
 * un orphelin invisible.
 */

/** Ce qui ressemble à un contrôle : son nom le dit. */
const CHECK_NAME = /^export function ((?:audit|guard|check|validate)[A-Z]\w*|\w*Findings)\s*[(<]/gm;

/**
 * Contrôles écrits d'avance, et l'action qu'ils garderaient et qui n'existe pas.
 *
 * Aucun n'est un oubli : ce sont des garde-fous tirés des parties E, G et I,
 * écrits avant l'écran qui les déclencherait. Les inscrire les rend visibles
 * comme dette nommée plutôt que comme silence.
 */
const DECLARED_NOT_WIRED: Readonly<Record<string, string>> = {
  guardTemplateBlockOverflow:
    'E10 — refus d’enregistrer un gabarit dont un bloc déborde de la grille. L’éditeur ne fait pas encore d’édition de gabarit.',
  guardToolForPointer:
    'G3.1/G3.5 — désactivation des outils de tracé libre sous un pointeur grossier. L’éditeur ne distingue pas encore le type de pointeur.',
  guardToolAction:
    'E1.4 — matrice de permissions par contexte d’édition, à interposer avant le réducteur d’outils. Le réducteur ne passe pas encore par elle.',
  checkOutputProfile:
    'E13 — chaîne colorimétrique, profil de sortie d’une couleur de charte. Aucun écran ne produit encore de sortie profilée.',
  guardUndoTarget:
    'E5.3 — refus d’annuler une modification déjà synchronisée. La synchronisation hors ligne n’est pas construite.',
  auditExtractionRate:
    'I3 — taux d’extraction des assistances. Aucune assistance n’est proposée à l’écran.',
  guardModuleOperation:
    'I5.2 — droits par module souscrit. Le studio n’a pas de notion de souscription active.',
  auditVectorImports:
    'G7.2 — reprise de fichiers vectoriels en référence de fond. L’écran d’import n’existe pas.',
  guardObjectEdit:
    'G4.2 — verrou consultatif de quinze minutes sur un objet en cours d’édition. L’édition concurrente n’est pas construite.',
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function productionSources(): string[] {
  const out: string[] = [];
  for (const group of ['packages', 'apps']) {
    for (const pkg of readdirSync(resolve(ROOT, group), { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      const src = resolve(ROOT, group, pkg.name, 'src');
      if (existsSync(src)) out.push(...walk(src));
    }
  }
  return out;
}

/** Un nom cité en commentaire n'est pas un appel. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/** Le corps déclarant, tel quel : c'est là qu'on lit les `export function`. */
const declarations = new Map<string, string>();
/** Le corps sans commentaires : c'est là qu'on cherche les appels. */
const bodies = new Map<string, string>();
for (const file of productionSources()) {
  const raw = readFileSync(file, 'utf-8');
  declarations.set(file, raw);
  bodies.set(file, stripComments(raw));
}

/** Les contrôles exportés, et le fichier qui les déclare. */
const declared: { name: string; file: string }[] = [];
for (const [file, body] of declarations) {
  for (const match of body.matchAll(CHECK_NAME)) {
    declared.push({ name: match[1] ?? '', file });
  }
}

function citedElsewhere(name: string, own: string): boolean {
  const needle = new RegExp(`\\b${name}\\b`);
  for (const [file, body] of bodies) {
    if (file === own) continue;
    if (needle.test(body)) return true;
  }
  return false;
}

const orphans = declared
  .filter(d => !citedElsewhere(d.name, d.file))
  .sort((a, b) => a.name.localeCompare(b.name));

describe('tout contrôle est branché, ou inscrit comme ne l’étant pas', () => {
  it('l’essai trouve bien des contrôles à examiner', () => {
    expect(declared.length).toBeGreaterThan(40);
  });

  it('aucun contrôle n’est orphelin sans raison inscrite', () => {
    const unexplained = orphans
      .filter(o => !(o.name in DECLARED_NOT_WIRED))
      .map(o => `${o.name} — ${relative(ROOT, o.file)}`);
    expect(
      unexplained,
      'Contrôles exportés qu’aucun autre fichier n’appelle :\n' + unexplained.join('\n') +
      '\n\nBranchez-les, ou inscrivez-les dans DECLARED_NOT_WIRED avec l’action ' +
      'qu’ils garderaient et qui n’existe pas encore.',
    ).toHaveLength(0);
  });

  it('la liste ne vieillit pas : rien n’y reste une fois le contrôle branché', () => {
    const names = new Set(orphans.map(o => o.name));
    const stale = Object.keys(DECLARED_NOT_WIRED).filter(n => !names.has(n)).sort();
    expect(
      stale,
      'Ces contrôles sont désormais appelés, ou ont disparu, et doivent sortir ' +
      'de DECLARED_NOT_WIRED :\n' + stale.join('\n'),
    ).toHaveLength(0);
  });

  it('chaque raison inscrite dit quelle action manque', () => {
    const thin = Object.entries(DECLARED_NOT_WIRED)
      .filter(([, why]) => why.trim().length < 40)
      .map(([name]) => name);
    expect(thin, `Raisons trop courtes :\n${thin.join('\n')}`).toHaveLength(0);
  });
});
