import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { F7_STATES } from '../../components/ui/ScreenStates.js';
import { MESSAGES_FR, MESSAGES_EN } from '../../i18n/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREENS = resolve(HERE, '..');

/**
 * Partie R — l'écran du tableau des messages, moitié consultation.
 *
 * Aucune bibliothèque de rendu n'est installée et A3.3 n'en préautorise
 * aucune : le contrôle porte sur la structure des sources, comme pour les
 * écrans de la tranche M. Il attrape le défaut qui compte ici, et c'est le
 * plus grave que cet écran puisse avoir — une cellule modifiable.
 */
function source(...parts: readonly string[]): string {
  return readFileSync(resolve(SCREENS, ...parts), 'utf8');
}

const SCREEN = source('MessageTableScreen.tsx');
const TABLE = source('message-table', 'LineTable.tsx');
const DETAIL = source('message-table', 'LineDetail.tsx');
const VERSION_BAR = source('message-table', 'VersionBar.tsx');
const COMPARE = source('message-table', 'CompareView.tsx');

/**
 * Critère 2 de R18 : « Aucune cellule n'est modifiable, par aucune voie :
 * clic, clavier, collage, action en série. »
 *
 * C'est la promesse centrale de l'écran, et elle découle de M02.W6 : le
 * tableau est généré, jamais saisi. Une cellule éditable la romprait sans
 * qu'aucun autre essai ne s'en aperçoive.
 */
describe('R18 (partie R) critère 2 — aucune cellule n’est modifiable', () => {
  it('le tableau ne porte aucun élément de saisie', () => {
    for (const forbidden of ['<input', '<textarea', '<select', 'contentEditable']) {
      expect(TABLE, forbidden).not.toContain(forbidden);
    }
  });

  it('le tableau n’écoute ni le collage ni la saisie', () => {
    for (const forbidden of ['onPaste', 'onInput', 'onChange', 'onBeforeInput']) {
      expect(TABLE, forbidden).not.toContain(forbidden);
    }
  });

  it('la comparaison de versions non plus', () => {
    // R11 (partie R) montre des valeurs anciennes et nouvelles : les montrer
    // dans un champ de saisie laisserait croire qu'on peut les reprendre là.
    for (const forbidden of ['<input', '<textarea', 'contentEditable', 'onPaste']) {
      expect(COMPARE, forbidden).not.toContain(forbidden);
    }
  });

  it('le panneau de détail non plus', () => {
    for (const forbidden of ['<input', '<textarea', 'contentEditable', 'onPaste']) {
      expect(DETAIL, forbidden).not.toContain(forbidden);
    }
  });

  /** R8 : l'écran le dit, il ne se contente pas de ne pas offrir la saisie. */
  it('l’écran dit qu’aucune cellule n’est modifiable', () => {
    expect(SCREEN).toContain("t('msgtable.readonly')");
    expect(MESSAGES_FR['msgtable.readonly']).toContain('modifiable');
  });
});

describe('F7 et R16 (partie R) — les états de l’écran', () => {
  it('les six états de F7 restent ceux du cahier', () => {
    expect([...F7_STATES]).toEqual([
      'empty', 'loading', 'partial', 'error', 'offline', 'permission_denied',
    ]);
  });

  it('l’écran passe par l’enveloppe des six états', () => {
    expect(SCREEN).toContain('<ScreenStates');
  });

  /**
   * R16, première ligne : « Vide, aucune version | Invitation à générer, avec
   * les prérequis visibles. Jamais un tableau vide présenté comme un
   * résultat. »
   */
  it('l’état vide invite à générer et nomme ses prérequis', () => {
    expect(SCREEN).toContain('invitation={{');
    const message = MESSAGES_FR['msgtable.empty.message'];
    for (const prerequisite of ['graphe validé', 'jalonnement', 'paquet de règles']) {
      expect(message, prerequisite).toContain(prerequisite);
    }
  });

  it('l’écran fournit sa structure d’attente', () => {
    expect(SCREEN).toContain('skeleton=');
  });
});

/**
 * R10 et F14 : « Aucun état n'est porté par la seule couleur : chaque pastille
 * a son libellé. » Critère 13 de R18 : lisibilité intégrale en niveaux de gris.
 */
describe('R10 et R17 (partie R) — aucun état porté par la seule couleur', () => {
  it('chaque état de ligne a son libellé dans les deux langues', () => {
    for (const state of ['current', 'stale', 'blocking', 'excluded'] as const) {
      const key = `msgtable.linestate.${state}` as const;
      expect(MESSAGES_FR[key].length, key).toBeGreaterThan(0);
      expect(MESSAGES_EN[key].length, key).toBeGreaterThan(0);
    }
  });

  it('chaque état de version a son libellé, ceux de R4', () => {
    expect(MESSAGES_FR['msgtable.state.draft']).toBe('Brouillon');
    expect(MESSAGES_FR['msgtable.state.in_review']).toBe('En revue');
    expect(MESSAGES_FR['msgtable.state.approved']).toBe('Approuvé');
    expect(MESSAGES_FR['msgtable.state.superseded']).toBe('Remplacé');
  });

  /** R5 (partie R) : « La direction est signalée par un symbole et un libellé. » */
  it('chaque direction de N2.2 a son libellé', () => {
    for (const direction of ['left', 'right', 'ahead', 'up', 'down', 'back'] as const) {
      const key = `msgtable.direction.${direction}` as const;
      expect(MESSAGES_FR[key].length, key).toBeGreaterThan(0);
    }
  });

  /** R5 (partie R) : les quatre niveaux d'information portent leur nom, pas leur chiffre. */
  it('les quatre niveaux d’information portent le nom que R5 leur donne', () => {
    expect(MESSAGES_FR['msgtable.level.1']).toBe('Identification');
    expect(MESSAGES_FR['msgtable.level.2']).toBe('Orientation');
    expect(MESSAGES_FR['msgtable.level.3']).toBe('Direction');
    expect(MESSAGES_FR['msgtable.level.4']).toBe('Confirmation');
  });

  /** R17 : le focus se distingue de la sélection. */
  it('le tableau porte deux marques distinctes, focus et sélection', () => {
    expect(TABLE).toContain('borderLeft: focused');
    expect(TABLE).toContain('background: selected');
    expect(TABLE).toContain('aria-selected');
  });
});

/**
 * R11 (partie R) : « Les marques combinent symbole et libellé, jamais la
 * couleur seule. » Critère 13 de R18, lisibilité en niveaux de gris.
 */
describe('R11 (partie R) — chaque marque porte un symbole et un libellé', () => {
  it('les quatre marques ont leur libellé dans les deux langues', () => {
    for (const change of ['added', 'removed', 'modified', 'unchanged'] as const) {
      const key = `msgtable.change.${change}` as const;
      expect(MESSAGES_FR[key].length, key).toBeGreaterThan(0);
      expect(MESSAGES_EN[key].length, key).toBeGreaterThan(0);
    }
  });

  it('et leur symbole, distinct l’un de l’autre', () => {
    const symbols = (['added', 'removed', 'modified', 'unchanged'] as const)
      .map(change => MESSAGES_FR[`msgtable.change.symbol.${change}`]);
    expect(new Set(symbols).size).toBe(4);
  });

  /**
   * Le symbole n'est pas caché aux technologies d'assistance : le cacher en
   * ferait une information réservée à la vue, quand R11 (partie R) veut les
   * deux. Il porte sa couleur en propre, pour rester calculable sur la rangée
   * en `text-muted` d'une ligne écartée.
   */
  it('le symbole n’est pas réservé à la vue, et porte sa couleur', () => {
    expect(COMPARE).not.toContain('aria-hidden');
    expect(COMPARE).toContain("color: 'var(--text-primary)'");
  });
});

describe('R4 (partie R) — une action non permise est absente, jamais grisée', () => {
  it('la barre de version ne désactive aucune action', () => {
    expect(VERSION_BAR).not.toContain('disabled');
  });
});
