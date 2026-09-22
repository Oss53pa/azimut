import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { F7_STATES } from '../../components/ui/ScreenStates.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREENS = resolve(HERE, '..');

/** Les écrans de la tranche M, par leur fichier. */
const TRANCHE_M = [
  'PlanCalibrationScreen.tsx',
  'FootprintsScreen.tsx',
  'GraphScreen.tsx',
  'ValidationScreen.tsx',
] as const;

function source(name: string): string {
  return readFileSync(resolve(SCREENS, name), 'utf8');
}

/**
 * F7 et M7.1 (partie M) — « Les six états sont traités. Un écran qui ne traite
 * que le cas nominal est incomplet. »
 *
 * Aucune bibliothèque de rendu n'est installée, et A3.3 n'en préautorise
 * aucune : le contrôle porte donc sur la structure des écrans, à la manière
 * de ceux du corpus de migrations. Il attrape le défaut qui compte — un écran
 * qui ne passe pas par l'enveloppe des six états — sans prétendre remplacer
 * l'essai au clavier que F16 demande par ailleurs, et qui reste à faire.
 */
describe('M7.1 (partie M) — les six états, sur chaque écran de la tranche', () => {
  it('les six états de F7 sont ceux du cahier', () => {
    expect([...F7_STATES]).toEqual([
      'empty', 'loading', 'partial', 'error', 'offline', 'permission_denied',
    ]);
  });

  it('les quatre écrans de la tranche existent', () => {
    const present = readdirSync(SCREENS).filter(n => n.endsWith('.tsx'));
    for (const screen of TRANCHE_M) expect(present, screen).toContain(screen);
  });

  /**
   * L'enveloppe traite les six états en un seul endroit. Un écran qui la
   * contourne les traiterait à sa façon, ou les oublierait — et c'est
   * exactement ce que F7 refuse.
   */
  it('chaque écran passe par l’enveloppe des six états', () => {
    for (const screen of TRANCHE_M) {
      expect(source(screen), screen).toContain('<ScreenStates');
    }
  });

  /** F7 : « Invitation à agir, avec l'action en évidence. » */
  it('chaque écran d’atelier propose une action dans son état vide', () => {
    for (const screen of ['PlanCalibrationScreen.tsx', 'FootprintsScreen.tsx', 'GraphScreen.tsx']) {
      expect(source(screen), screen).toContain('invitation={{');
    }
  });

  /** F7 : « Structure d'attente calquée sur la forme du contenu. » */
  it('chaque écran fournit sa structure d’attente', () => {
    for (const screen of TRANCHE_M) {
      expect(source(screen), screen).toContain('skeleton=');
    }
  });
});

/**
 * M6 (partie M) — « Tous figurent dans la liste fermée de la partie F. Cette
 * tranche n'en introduit aucun nouveau. Si un écran de cette tranche semble
 * exiger un composant absent de la liste, c'est l'écran qu'il faut revoir,
 * pas la liste qu'il faut étendre. »
 */
describe('M6 (partie M) — aucun composant hors de la liste fermée', () => {
  it('les écrans n’importent leurs composants que de la bibliothèque', () => {
    for (const screen of TRANCHE_M) {
      const imports = [...source(screen).matchAll(/from '([^']+)'/g)].map(m => m[1] ?? '');
      const components = imports.filter(i => i.includes('/components/'));
      for (const component of components) {
        expect(component, `${screen} → ${component}`).toContain('components/ui/index.js');
      }
    }
  });

  /**
   * Aucun écran ne fabrique son propre contrôle de saisie. Un `<input>` écrit
   * dans un écran échapperait à l'unité obligatoire de F6.1 et aux états de
   * F6.1. Deux exceptions, et elles sont nommées : le sélecteur de fichier de
   * M2 (partie M), que F6 range parmi les superpositions, et rien d'autre.
   */
  it('aucun écran ne fabrique son propre champ de saisie', () => {
    const allowed = new Map<string, number>([['PlanCalibrationScreen.tsx', 1]]);
    for (const screen of TRANCHE_M) {
      const inputs = [...source(screen).matchAll(/<input\b/g)].length;
      expect(inputs, screen).toBe(allowed.get(screen) ?? 0);
    }
  });
});

/**
 * M7.3 (partie M) — « Toute valeur calculée est en lecture seule, et son
 * caractère calculé est visible. »
 */
describe('M7.3 (partie M) — les valeurs calculées se disent calculées', () => {
  it('la surface d’une empreinte est marquée calculée', () => {
    const body = source('FootprintsScreen.tsx');
    const area = body.slice(body.indexOf("label={t('fp.field.area')}"));
    expect(area.slice(0, 300)).toContain('computed');
  });

  it('la longueur d’une arête est marquée calculée', () => {
    const body = source('GraphScreen.tsx');
    const length = body.slice(body.indexOf("label={t('graph.edge.length')}"));
    expect(length.slice(0, 400)).toContain('computed');
  });
});

/**
 * M7.4 (partie M) — « Tout champ dimensionnel affiche son unité. »
 *
 * Le type l'impose déjà : `unit` est obligatoire sur le champ numérique. Ce
 * contrôle guette le contournement — une unité vide, qui satisferait le type
 * sans rien afficher.
 */
describe('M7.4 (partie M) — aucune unité vide', () => {
  it('aucun champ numérique ne passe une unité vide', () => {
    for (const screen of TRANCHE_M) {
      expect(source(screen), screen).not.toMatch(/unit=(""|''|\{''\}|\{""\})/);
    }
  });
});
