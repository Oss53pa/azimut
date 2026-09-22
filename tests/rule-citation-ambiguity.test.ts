import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * N0 — une règle numérotée est opposable : elle se cite en revue et en test.
 *
 * Les règles de module portent désormais leur numéro de module — `M01.S2`,
 * `M02.W6`, `M04.G1` — et les quatre règles d'intégration de la partie L
 * s'appellent `INT-1` à `INT-4`. Ce préfixe lève la collision du côté du
 * cahier des charges consolidé. Elle demeure du côté des seize documents
 * antérieurs, qui ne font plus foi mais que du code écrit sous eux cite
 * encore :
 *
 * - `M1` à `M17` : modules du complément atelier contre écrans de la partie M,
 *   où `M7` est un générateur de plans d'un côté et des règles d'écran de
 *   l'autre ;
 * - `R1` à `R6` et `P1` à `P7` : principes du même complément, dont les jetons
 *   ressemblent à s'y méprendre aux anciennes règles de module.
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
 * qu'une citation peut nommer. La limite est assumée : un bloc qui citerait à la fois une section de N
 * et un module du complément passerait, et c'est un cas qu'on n'a pas vu.
 */
const QUALIFIER = /complément atelier|partie [MNLR]|tranche M|atelier-|\bN[0-9](?:\.[0-9]+)?\b/i;

const COMMENT = /\/\*[\s\S]*?\*\/|^[ \t]*\/\/.*$/gm;

const RULE_REF = /ruleRef:\s*'([^']*)'/g;

/**
 * Un `ruleRef` ne se qualifie pas en prose : il porte son document en préfixe.
 * `atelier-M1.4` et `partieM-M2` sont les deux formes en usage.
 */
const REF_QUALIFIER = /^(?:atelier|partieM|partieN|partieL|partieR)-/;

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
      '\n\nÉcrivez « M2 (complément atelier) », « M4 (partie M) », « P1 (partie N) » — ' +
      'le jeton seul désigne deux règles différentes selon le document.',
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
      '\n\nUn ruleRef porte son document en préfixe : `atelier-M2`, `partieM-M2`.',
    ).toHaveLength(0);
  });

  it('l’essai voit une citation nue, sinon il ne garde rien', () => {
    // Garde-fou du garde-fou : si les deux motifs cessaient de mordre,
    // l'essai passerait sur un dépôt entièrement ambigu sans rien dire.
    expect(AMBIGUOUS.test('// le contrôle M2 demande')).toBe(true);
    expect(QUALIFIER.test('// le contrôle M2 demande')).toBe(false);
    expect(QUALIFIER.test('// M2 (complément atelier) demande')).toBe(true);
    expect(QUALIFIER.test('// écran M4 (partie M)')).toBe(true);
    expect(QUALIFIER.test('// N5.2 — R5 et R6')).toBe(true);
    expect(QUALIFIER.test('// R5 tout seul')).toBe(false);
    // Et il ne mord pas sur ce qui n'est pas un jeton de règle.
    expect(AMBIGUOUS.test('// un chemin d="M20 30"')).toBe(false);
    expect(AMBIGUOUS.test('// le niveau R7')).toBe(false);
    // Même garde sur les ruleRef.
    expect(REF_QUALIFIER.test('M2')).toBe(false);
    expect(REF_QUALIFIER.test('atelier-M2')).toBe(true);
    expect(REF_QUALIFIER.test('partieM-M2')).toBe(true);
    expect(AMBIGUOUS.test('A5.8')).toBe(false);
  });
});
