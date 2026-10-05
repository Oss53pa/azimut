import type { Point } from '@azimut/core-model';
import { codePointCompare } from '@azimut/core-model';
import type { SketchStroke } from './sketch.js';

/**
 * J3.3 (partie J) — la promotion d'une esquisse : « entourer une esquisse et
 * demander sa conversion produit une forme reconnue, arbitrée et quantifiée
 * comme n'importe quelle saisie. La promotion est explicite, jamais
 * automatique. »
 *
 * Deux temps, séparés : le lasso choisit les traits (J1.2, « boucle autour de
 * plusieurs formes : sélection ») ; la conversion n'a lieu qu'à la demande. Le
 * trait d'esquisse reste ce qu'il est : la forme produite est une saisie
 * nouvelle, et l'esquisse n'est ni modifiée ni retirée.
 */

/** Le point est-il dans le polygone ? Règle pair-impair, bord compris d'un seul côté. */
function inside(point: Point, loop: readonly Point[]): boolean {
  let crossings = 0;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i];
    const b = loop[j];
    if (a === undefined || b === undefined) continue;
    if ((a.y_m > point.y_m) !== (b.y_m > point.y_m)) {
      const x = a.x_m + ((point.y_m - a.y_m) * (b.x_m - a.x_m)) / (b.y_m - a.y_m);
      if (point.x_m < x) crossings += 1;
    }
  }
  return crossings % 2 === 1;
}

/** Les traits entièrement entourés par le lasso, par identifiant. */
export function strokesInside(loop: readonly Point[], strokes: readonly SketchStroke[]): readonly string[] {
  if (loop.length < 3) return [];
  return strokes
    .filter(s => s.points.length > 0 && s.points.every(p => inside(p, loop)))
    .map(s => s.id)
    .sort(codePointCompare);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x_m - b.x_m, a.y_m - b.y_m);
}

/**
 * Les traits choisis mis bout à bout, en un seul tracé : « suite de traits
 * fermée : polygone » (J1.2).
 *
 * L'enchaînement part du premier trait par identifiant, puis prend à chaque
 * pas le trait dont une extrémité est la plus proche de la fin courante,
 * retourné s'il le faut. À égalité, l'identifiant tranche : le tracé produit
 * ne dépend que des traits choisis, jamais de l'ordre où on les a tracés.
 */
export function chainStrokes(strokes: readonly SketchStroke[], ids: readonly string[]): readonly Point[] {
  const remaining = strokes
    .filter(s => ids.includes(s.id) && s.points.length > 0)
    .sort((a, b) => codePointCompare(a.id, b.id));
  const first = remaining.shift();
  if (first === undefined) return [];
  const chain: Point[] = first.points.map(p => ({ x_m: p.x_m, y_m: p.y_m }));
  while (remaining.length > 0) {
    const end = chain[chain.length - 1];
    if (end === undefined) break;
    let best = 0;
    let reversed = false;
    let bestDistance = Infinity;
    remaining.forEach((stroke, index) => {
      const head = stroke.points[0];
      const tail = stroke.points[stroke.points.length - 1];
      if (head === undefined || tail === undefined) return;
      const toHead = distance(end, head);
      const toTail = distance(end, tail);
      if (toHead < bestDistance) { best = index; reversed = false; bestDistance = toHead; }
      if (toTail < bestDistance) { best = index; reversed = true; bestDistance = toTail; }
    });
    const [next] = remaining.splice(best, 1);
    if (next === undefined) break;
    const points = next.points.map(p => ({ x_m: p.x_m, y_m: p.y_m }));
    chain.push(...(reversed ? points.reverse() : points));
  }
  return chain;
}
