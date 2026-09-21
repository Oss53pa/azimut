import { describe, it, expect } from 'vitest';
import { ERROR_CATALOG } from '@azimut/core-model';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * D2 — un code déclaré au catalogue et qu'aucun moteur ne lève.
 *
 * C'est un contrôle qui a l'air d'exister et qui ne tourne pas. Le défaut est
 * passé trois fois : les deux codes du lexique de charte figuraient au
 * catalogue depuis l'origine sans qu'aucun moteur ne les écrive ;
 * `PARK.PROPOSAL_AS_EXISTING` était écrit mais jamais atteint, faute
 * d'appelant ; `FLOW.WEIGHTS_NOT_NORMALIZED` attendait qu'on vérifie qu'une
 * part décompose bien le tout. Trois fois, la découverte a été fortuite.
 *
 * **Ce que cet essai ne voit pas** : il vérifie qu'un code est levé quelque
 * part, non que la fonction qui le lève soit appelée. Une fonction de contrôle
 * écrite et laissée hors de son point d'entrée lui paraît saine. C'est
 * `check-wiring.test.ts` qui tient ce second cas, et il a fallu les deux.
 *
 * Cet essai la rend systématique. Il ne demande pas que tout code soit levé —
 * plusieurs attendent une capacité non construite ou une décision non prise —
 * mais que la liste de ceux qui ne le sont pas soit tenue à jour et motivée.
 * Elle est comparée dans les deux sens : un code qu'on se met à lever doit
 * sortir de la liste, faute de quoi elle vieillirait en silence, ce qui est le
 * défaut même qu'elle sert à empêcher.
 */

/** Fichiers qui portent les codes comme données, non comme anomalies levées. */
const CATALOGUE_FILES = [
  'error-catalog.ts',
  'i18n-errors-fr.ts',
  'i18n-errors-en.ts',
];

/**
 * Codes déclarés, non levés, et la raison — vérifiée, pas supposée.
 *
 * Trois familles de raisons, et aucune n'est « on a oublié » :
 * la capacité n'est pas construite, la donnée manque au modèle, ou le paquet
 * de règles fait défaut. Les deux dernières relèvent de A2.2 : elles ne se
 * lèvent pas en écrivant du code.
 */
const DECLARED_NOT_RAISED: Readonly<Record<string, string>> = {
  'DATA.NAME_REQUIRED':
    'Contrôle de saisie du formulaire de création de M1 (partie M), écran non encore construit. Lot 1.4 de la tranche 1.',
  'DATA.NAME_DUPLICATE':
    'Même écran, même lot. L’unicité se vérifie dans l’organisation, donc contre le dépôt, non dans un moteur.',
  'DATA.COUNTRY_REQUIRED':
    'Formulaire de création de M1 (partie M), champ « Pays », écran non encore construit. Lot 1.4 de la tranche 1.',
  'DATA.LANG_REQUIRED':
    'Formulaire de création de M1 (partie M), champ « Langues actives », qui en exige au moins une. Même lot.',
  'IMPORT.FILE_TOO_LARGE':
    'Contrôle de l’étape 1 de M2 (partie M), import du fond de plan. L’écran d’import n’est pas construit ; le seuil de 60 Mo que M2 nomme est une valeur d’interface, non normative.',
  'IMPORT.FORMAT_UNSUPPORTED':
    'Même étape, même lot. La liste des formats acceptés est celle de M2 (partie M) : PDF, PNG, JPG, DWG.',
  'IMPORT.PAGE_REQUIRED':
    'Même étape, même lot. Ne se lève que pour un PDF multipage, cas que l’import ne traite pas encore.',
  'LAYOUT.LANG_VARIANT_MISSING':
    'Jumeau côté composition de GRAPH.DESTINATION_NAME_MISSING, que validateDirectory lève. ' +
    'renderFace compose une langue à la fois et ne confronte pas son contenu à la liste des langues actives du site.',
  'LAYOUT.CHROMATIC_ADJACENCY':
    'Un des trois contrôles que runChecks déclare non exercés faute de paquet de règles (adjacence_chromatique). A2.2.',
  'LAYOUT.LOGO_BELOW_MIN_WIDTH':
    'Aucune charte du modèle ne porte de largeur minimale de logo. La donnée manque, pas le contrôle. A2.2.',
  'IMPORT.UNIT_AMBIGUOUS':
    'Les deux importeurs écrits (supports, occupation) lisent des colonnes sans unité. ' +
    'L’import vectoriel de D4, qui rencontrerait le cas, n’est pas un moteur.',
  'IMPORT.ENCODING_UNSUPPORTED':
    'Même raison : les importeurs reçoivent du texte déjà décodé, l’encodage se joue en amont.',
  'INK.SHAPE_NOT_RECOGNIZED':
    'Couche d’esquisse et saisie à l’encre, partie J, non construite.',
  'PICTO.SAFETY_EDIT_DENIED':
    'L’éditeur de pictogrammes de la partie J n’est pas construit. ' +
    'L’invariant 3 est tenu sur le chemin qui existe, celui de la charte, par guardCharterOnSafety et SECURITY.CHARTER_OVERRIDE_DENIED.',
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !CATALOGUE_FILES.includes(entry.name)) out.push(full);
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

/** Les commentaires ne lèvent rien : un code cité en prose n'est pas un contrôle. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const CODE_LITERAL = /'([A-Z][A-Z0-9_]*\.[A-Z0-9_]+)'/g;

describe('D2 — tout code du catalogue est levé, ou déclaré non levé et motivé', () => {
  // Le catalogue se lit comme un objet, non comme du texte. Le balayage
  // textuel prenait aussi les codes de `RETIRED_CODES` pour des déclarations,
  // alors qu'un code retiré n'est précisément plus au catalogue : sa valeur
  // reste seulement réservée (D2.1).
  const declared = Object.keys(ERROR_CATALOG);

  const raised = new Set<string>();
  for (const file of productionSources()) {
    const body = stripComments(readFileSync(file, 'utf-8'));
    for (const m of body.matchAll(CODE_LITERAL)) raised.add(m[1] ?? '');
  }

  const notRaised = declared.filter(code => !raised.has(code)).sort();
  const listed = Object.keys(DECLARED_NOT_RAISED).sort();

  it('le catalogue n’est pas vide et se lit', () => {
    expect(declared.length).toBeGreaterThan(150);
  });

  it('aucun code n’est muet sans être inscrit et motivé', () => {
    const unexplained = notRaised.filter(code => !(code in DECLARED_NOT_RAISED));
    expect(
      unexplained,
      'Codes déclarés au catalogue D2 qu’aucun moteur ne lève, et qui ne figurent pas ' +
      'dans DECLARED_NOT_RAISED :\n' + unexplained.join('\n') +
      '\n\nUn code muet est un contrôle qui a l’air d’exister. Levez-le, ou inscrivez-le ' +
      'ici avec la raison — capacité non construite, donnée absente du modèle, paquet de ' +
      'règles manquant.',
    ).toHaveLength(0);
  });

  it('la liste ne vieillit pas : rien n’y reste une fois le code levé', () => {
    const nowRaised = listed.filter(code => raised.has(code));
    expect(
      nowRaised,
      'Ces codes sont désormais levés par un moteur et doivent sortir de ' +
      'DECLARED_NOT_RAISED :\n' + nowRaised.join('\n'),
    ).toHaveLength(0);
  });

  it('la liste ne cite aucun code absent du catalogue', () => {
    const unknown = listed.filter(code => !declared.includes(code));
    expect(unknown, `Codes inscrits mais absents du catalogue D2 :\n${unknown.join('\n')}`)
      .toHaveLength(0);
  });

  it('chaque raison inscrite dit quelque chose', () => {
    const empty = listed.filter(code => (DECLARED_NOT_RAISED[code] ?? '').trim().length < 40);
    expect(empty, `Raisons vides ou trop courtes :\n${empty.join('\n')}`).toHaveLength(0);
  });
});
