import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCT_MODULES, MODULE_FAMILIES, SIDEBAR_FAMILIES, moduleOfView, modulesOfFamily,
} from '../product-map.js';
import { MESSAGES_FR } from '../i18n/messages.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..');

/** Identifiants d'écran déclarés par `views.ts`, lus à la source. */
function declaredViewIds(): readonly string[] {
  const source = readFileSync(resolve(SRC, 'views.ts'), 'utf-8');
  return [...source.matchAll(/^\s*\|?\s*'([a-z-]+)';?$/gm)].map(m => m[1] ?? '');
}

/** Écrans hors module : le chrome de l'application. */
const CHROME_VIEWS = new Set(['dashboard', 'product-map']);

describe('Partie H — la carte du produit', () => {
  it('déclare les quatorze modules, numérotés sans trou', () => {
    expect(PRODUCT_MODULES).toHaveLength(14);
    expect(PRODUCT_MODULES.map(m => m.number)).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14',
    ]);
  });

  it('range la barre latérale comme la maquette', () => {
    const order = SIDEBAR_FAMILIES.map(f => modulesOfFamily(f).map(m => m.number));
    expect(order).toEqual([
      ['01', '02', '03', '04', '12'],
      ['07', '09'],
      ['08', '06', '05', '13'],
      ['14'],
    ]);
  });

  it('laisse au pilotage le portefeuille et les fonctions transverses', () => {
    expect(SIDEBAR_FAMILIES).not.toContain('steering');
    expect(modulesOfFamily('steering').map(m => m.number)).toEqual(['10', '11']);
  });

  it('range chaque module dans une famille connue', () => {
    const covered = MODULE_FAMILIES.flatMap(family => [...modulesOfFamily(family)]);
    expect(covered).toHaveLength(PRODUCT_MODULES.length);
  });

  it('rattache chaque écran à un module, hors chrome', () => {
    for (const view of declaredViewIds()) {
      if (CHROME_VIEWS.has(view)) continue;
      expect(moduleOfView(view as never), `écran sans module : ${view}`).toBeDefined();
    }
  });

  it('n’attribue jamais deux fois le même écran', () => {
    const seen = new Set<string>();
    for (const module of PRODUCT_MODULES) {
      for (const view of [module.entry, ...module.screens.map(s => s.view)]) {
        expect(seen.has(view), `écran en double : ${view}`).toBe(false);
        seen.add(view);
      }
    }
  });

  it('nomme chaque module et chaque écran par une clé du catalogue', () => {
    for (const module of PRODUCT_MODULES) {
      expect(MESSAGES_FR[module.nameKey]).toBeTruthy();
      expect(MESSAGES_FR[module.summaryKey]).toBeTruthy();
      for (const screen of module.screens) {
        expect(MESSAGES_FR[screen.labelKey]).toBeTruthy();
      }
    }
  });
});

describe('Le routeur couvre tous les écrans', () => {
  it('traite chaque identifiant déclaré par un cas', () => {
    const router = readFileSync(resolve(SRC, 'components', 'ViewRouter.tsx'), 'utf-8');
    const missing = declaredViewIds().filter(view => !router.includes(`case '${view}':`));
    expect(missing, `écrans non routés : ${missing.join(', ')}`).toHaveLength(0);
  });

  it('ne route aucun écran qui n’est pas déclaré', () => {
    const router = readFileSync(resolve(SRC, 'components', 'ViewRouter.tsx'), 'utf-8');
    const declared = new Set(declaredViewIds());
    const routed = [...router.matchAll(/case '([a-z-]+)':/g)].map(m => m[1] ?? '');
    const extra = routed.filter(view => !declared.has(view));
    expect(extra, `écrans routés sans déclaration : ${extra.join(', ')}`).toHaveLength(0);
  });
});
