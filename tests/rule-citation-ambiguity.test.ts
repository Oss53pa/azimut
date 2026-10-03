import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * N0 — une règle numérotée est opposable : elle se cite en revue et en test.
 *
 * Les règles de module portent leur numéro de module — `M01.S2`, `M02.W6`,
 * `M04.G1` — et les quatre règles d'intégration de la partie L s'appellent
 * `INT-1` à `INT-4`. Ce préfixe lève la collision du côté du cahier des
 * charges consolidé. Elle demeurait du côté des seize documents antérieurs,
 * qui ne font plus foi, et dont du code écrit sous eux citait encore les
 * jetons :
 *
 * - `M1` à `M17` : modules d'un document antérieur contre écrans de la partie
 *   M, où `M7` était un générateur de plans d'un côté et des règles d'écran de
 *   l'autre ;
 * - `R1` à `R6` et `P1` à `P7` : principes du même document, dont les jetons
 *   ressemblaient à s'y méprendre aux anciennes règles de module.
 *
 * Un jeton écrit seul dans un commentaire ne désigne donc rien de précis. Pire,
 * il en a l'air : c'est une citation qui ne se vérifie pas, et qui autorise le
 * lecteur à comprendre la mauvaise règle. L'essai exige que le bloc de
 * commentaire qui cite un jeton ambigu nomme aussi son document.
 *
 * Deux endroits sont balayés, et deux seulement. Les commentaires, où la
 * citation s'écrit en prose. Et les champs `ruleRef` d'une anomalie, qui sont
 * des citations par construction — un `ruleRef` ne contient rien d'autre. Le
 * reste du code est laissé tranquille : les mêmes jetons y sont des données
 * légitimes — `level: 'R1'` désigne un niveau, `d="M10 10"` est un chemin SVG
 * — et un balayage plus large rendrait l'essai bruyant, donc tôt ou tard
 * affaibli.
 */

/**
 * Jetons qui portent deux sens selon le document qui les écrit.
 *
 * La garde finale écarte `M12.A2` et `M11.X4` : un préfixe de module suivi
 * d'une lettre de règle n'est plus un jeton ambigu, c'est le nom complet.
 */
const AMBIGUOUS = /\b(?:M(?:1[0-7]|[1-9])|R[1-6]|P[1-7])(?:\.[0-9]+)?\b(?!\.[A-Z])/;

/**
 * Ce qui lève l'ambiguïté, et rien d'autre.
 *
 * Une référence de section de la partie N — `N3.2`, `N5.2` — compte comme
 * qualificatif : c'est là que vivent les règles `S`, `W`, `P`, `G`, `R` et les
 * autres, et la citer nomme le document aussi sûrement que d'écrire « partie
 * N ». La partie R, spécification de l'écran du tableau des messages, numérote
 * ses règles `R1`, `R5`, `R12` : elle entre donc dans la liste des documents
 * qu'une citation peut nommer.
 *
 * **Les documents antérieurs en sont sortis.** Ils qualifiaient une citation
 * jusqu'ici, et c'était le moindre mal quand du code les citait encore. Ils ne
 * font plus foi, et une citation qui les nommerait enverrait le lecteur à un
 * document qu'on lui interdit d'ouvrir pour trancher. Un jeton ambigu ne se
 * qualifie donc plus que par une partie du consolidé — ce qui, en pratique,
 * veut dire que la règle citée doit d'abord y avoir été retrouvée.
 */
const QUALIFIER = /partie ?[MNLR]-?|tranche M|\bN[0-9](?:\.[0-9]+)?\b/i;

const COMMENT = /\/\*[\s\S]*?\*\/|^[ \t]*\/\/.*$/gm;

const RULE_REF = /ruleRef:\s*'([^']*)'/g;

/**
 * Un `ruleRef` ne se qualifie pas en prose : il porte son document en préfixe.
 * `partieM-M2` en est la forme en usage.
 *
 * Le préfixe d'un document antérieur en est sorti : ces documents ont cessé
 * de faire foi, et plus aucun renvoi ne doit les citer. Voir l'essai dédié
 * plus bas.
 */
const REF_QUALIFIER = /^(?:partieM|partieN|partieL|partieR)-/;

/**
 * Le nom du document retiré, assemblé à l'exécution.
 *
 * Écrit d'un trait, il ferait correspondre ce fichier à son propre balayage, et
 * il faudrait alors une liste d'exceptions — c'est-à-dire une porte. Assemblé,
 * le balayage n'a aucune exception et se passe lui-même.
 */
const RETIRED_DOCUMENT = ['atelier', 'complément'].reverse().join(' ');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Les migrations sont balayées aussi.
 *
 * Un commentaire de migration est le commentaire de provenance par excellence :
 * il dit d'où vient une table. Il ne s'exécute pas, et le registre d'application
 * est tenu par nom, non par empreinte : le réécrire ne fait donc réapparaître
 * aucune migration comme non appliquée.
 */
function migrations(): string[] {
  const dir = resolve(ROOT, 'packages/db/migrations');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(sql|md)$/.test(entry.name))
    .map((entry) => resolve(dir, entry.name));
}

function sources(): string[] {
  const out: string[] = [];
  for (const group of ['packages', 'apps']) {
    for (const pkg of readdirSync(resolve(ROOT, group), { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      const src = resolve(ROOT, group, pkg.name, 'src');
      if (existsSync(src)) out.push(...walk(src));
    }
  }
  out.push(...walk(resolve(ROOT, 'tests')));
  return out;
}

describe('N0 — un jeton de règle ambigu nomme le document qui le porte', () => {
  it('aucun commentaire ne cite M, R ou P sans dire de quel document', () => {
    const offenders: string[] = [];
    for (const file of sources()) {
      const body = readFileSync(file, 'utf-8');
      for (const match of body.matchAll(COMMENT)) {
        const block = match[0];
        if (!AMBIGUOUS.test(block)) continue;
        if (QUALIFIER.test(block)) continue;
        const line = body.slice(0, match.index ?? 0).split('\n').length;
        const token = AMBIGUOUS.exec(block)?.[0] ?? '?';
        offenders.push(
          `${relative(ROOT, file)}:${line} [${token}] ${block.split('\n').map(s => s.trim()).join(' ').slice(0, 90)}`,
        );
      }
    }
    expect(
      offenders,
      'Citations ambiguës (CLAUDE.md, collisions de codes) :\n' + offenders.join('\n') +
      '\n\nÉcrivez « M4 (partie M) », « P1 (partie N) » — le jeton seul désigne ' +
      'deux règles différentes selon le document, et seul le consolidé fait foi.',
    ).toHaveLength(0);
  });

  it('aucun ruleRef ne porte un jeton ambigu sans son préfixe de document', () => {
    const offenders: string[] = [];
    for (const file of sources()) {
      const body = readFileSync(file, 'utf-8');
      for (const match of body.matchAll(RULE_REF)) {
        const ref = match[1] ?? '';
        if (!AMBIGUOUS.test(ref)) continue;
        if (REF_QUALIFIER.test(ref)) continue;
        const line = body.slice(0, match.index ?? 0).split('\n').length;
        offenders.push(`${relative(ROOT, file)}:${line} ruleRef: '${ref}'`);
      }
    }
    expect(
      offenders,
      'ruleRef ambigus :\n' + offenders.join('\n') +
      '\n\nUn ruleRef porte son document en préfixe : `partieM-M2`.',
    ).toHaveLength(0);
  });

  /**
   * Le document antérieur a cessé de faire foi. Ce qu'il portait de vivant est
   * repris par le consolidé : les faits du site en A5.11 avec la règle M01.S11,
   * le calage à n points en section M2 de la partie M, les limites de rédaction
   * par les règles de charte d'A5.8, la tolérance de coïncidence en D1.5. Un
   * renvoi qui le
   * citerait encore enverrait le lecteur à un document qu'on lui interdit
   * d'ouvrir pour trancher.
   */
  it('aucun ruleRef ne cite un document retiré', () => {
    const offenders: string[] = [];
    for (const file of sources()) {
      const body = readFileSync(file, 'utf-8');
      for (const match of body.matchAll(RULE_REF)) {
        const ref = match[1] ?? '';
        if (!ref.startsWith('atelier-')) continue;
        const line = body.slice(0, match.index ?? 0).split('\n').length;
        offenders.push(`${relative(ROOT, file)}:${line} ruleRef: '${ref}'`);
      }
    }
    expect(
      offenders,
      'Renvois à un document retiré :\n' + offenders.join('\n')
      + '\n\nIl ne fait plus foi. Le renvoi va à la section du consolidé qui '
      + 'porte la règle.',
    ).toHaveLength(0);
  });

  /**
   * Plus aucune mention du document retiré, nulle part.
   *
   * Les deux essais ci-dessus visent les citations de règle. Celui-ci vise le
   * nom du document lui-même, y compris dans un commentaire de provenance —
   * « cette table vient de tel document » — qui n'est pas une citation de règle
   * mais envoie le lecteur au même endroit interdit.
   *
   * Ce qu'il portait de vivant est repris par le consolidé, et c'est la section
   * du consolidé qu'un commentaire nomme désormais. Ce qu'il portait et que le
   * consolidé ne reprend pas se déclare comme tel, sans le citer : le dire
   * « hors du cahier des charges » suffit, et c'est plus honnête que de
   * renvoyer à un document qu'on interdit d'ouvrir pour trancher.
   */
  it('aucune mention du document retiré ne subsiste, provenance comprise', () => {
    const offenders: string[] = [];
    const needle = RETIRED_DOCUMENT.toLowerCase();
    for (const file of [...sources(), ...migrations()]) {
      const body = readFileSync(file, 'utf-8');
      const lines = body.split('\n');
      lines.forEach((line, index) => {
        // Les guillemets et les tirets d'une citation ne changent rien : c'est
        // le nom du document qu'on cherche, sous toutes ses ponctuations.
        const flat = line.toLowerCase().replace(/[«»"'’,\u2013\u2014-]/g, ' ').replace(/\s+/g, ' ');
        if (!flat.includes(needle)) return;
        offenders.push(`${relative(ROOT, file)}:${String(index + 1)} ${line.trim().slice(0, 100)}`);
      });
    }
    expect(
      offenders,
      'Mentions d’un document retiré :\n' + offenders.join('\n')
      + '\n\nIl ne fait plus foi. Nommez la section du consolidé qui porte la '
      + 'règle, ou dites que le cahier des charges ne la porte pas.',
    ).toHaveLength(0);
  });

  it('l’essai voit une citation nue, sinon il ne garde rien', () => {
    // Garde-fou du garde-fou : si les deux motifs cessaient de mordre,
    // l'essai passerait sur un dépôt entièrement ambigu sans rien dire.
    expect(AMBIGUOUS.test('// le contrôle M2 demande')).toBe(true);
    expect(QUALIFIER.test('// le contrôle M2 demande')).toBe(false);
    expect(QUALIFIER.test('// écran M4 (partie M)')).toBe(true);
    expect(QUALIFIER.test('// N5.2 — R5 et R6')).toBe(true);
    expect(QUALIFIER.test('// R5 tout seul')).toBe(false);
    // Et il ne mord pas sur ce qui n'est pas un jeton de règle.
    expect(AMBIGUOUS.test('// un chemin d="M20 30"')).toBe(false);
    expect(AMBIGUOUS.test('// le niveau R7')).toBe(false);
    // Même garde sur les ruleRef.
    expect(REF_QUALIFIER.test('M2')).toBe(false);
    expect(REF_QUALIFIER.test('atelier-M2')).toBe(false);
    // Et la garde du nom mord : sans cela, l'essai ci-dessus passerait sur un
    // dépôt qui le citerait partout.
    expect('venu du ' + RETIRED_DOCUMENT).toContain(RETIRED_DOCUMENT);
    expect(REF_QUALIFIER.test('partieM-M2')).toBe(true);
    expect(AMBIGUOUS.test('A5.8')).toBe(false);
  });
});