import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSvg } from '@azimut/core-model';

/**
 * Lot 6 de l'audit : le studio n'injecte un SVG dans la page qu'après l'avoir
 * fait passer par la liste blanche, profil `render` (`SafeSvg`). Ce contrôle
 * vérifie que tout ce que les moteurs produisent y passe : une sortie de
 * moteur refusée laisserait un écran vide.
 *
 * Les sorties lues sont celles de l'essai visuel, qui rend les plans, les
 * vues isométriques et les faces des sites de référence.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(HERE, '__snapshots__', 'visual.test.ts.snap');

function snapshotSvgs(): readonly { readonly name: string; readonly svg: string }[] {
  const text = readFileSync(SNAPSHOT, 'utf8');
  const out: { name: string; svg: string }[] = [];
  for (const m of text.matchAll(/exports\[`([^`]*)`\] = `([\s\S]*?)`;\n/g)) {
    const body = (m[2] ?? '').replace(/\\`/g, '`').replace(/\\\$\{/g, '${').replace(/\\\\/g, '\\').trim();
    const svg = body.replace(/^"|"$/g, '');
    if (svg.startsWith('<svg')) out.push({ name: m[1] ?? '', svg });
  }
  return out;
}

describe('lot 6 : toute sortie de moteur passe la liste blanche de rendu', () => {
  const svgs = snapshotSvgs();

  it('l’essai visuel fournit des sorties à vérifier', () => {
    expect(svgs.length).toBeGreaterThan(5);
  });

  it.each(svgs.map(s => [s.name, s.svg] as const))('%s', (_name, svg) => {
    const out = validateSvg(svg, 'render');
    expect(out.ok ? 'accepté' : `${out.reason} ${out.detail}`).toBe('accepté');
  });
});
