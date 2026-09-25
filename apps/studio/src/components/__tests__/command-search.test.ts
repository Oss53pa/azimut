import { describe, it, expect } from 'vitest';
import { commandEntries, normalize, searchCommands } from '../command-search.js';
import { siteInitials } from '../site-initials.js';
import { MESSAGES_FR, type UiMessageKey } from '../../i18n/messages.js';
import { PRODUCT_MODULES } from '../../product-map.js';

const t = (key: UiMessageKey): string => MESSAGES_FR[key];

describe('La recherche « aller à »', () => {
  const entries = commandEntries();

  it('indexe l’accueil, la carte du produit, chaque module et chaque écran', () => {
    const screens = PRODUCT_MODULES.reduce((n, m) => n + 1 + m.screens.length, 0);
    expect(entries).toHaveLength(2 + screens);
    expect(entries[0]?.view).toBe('dashboard');
  });

  it('rend tout sans requête', () => {
    expect(searchCommands(entries, '  ', t)).toHaveLength(entries.length);
  });

  it('ignore la casse et les accents', () => {
    expect(normalize('Régie Publicitaire')).toBe('regie publicitaire');
    const found = searchCommands(entries, 'REGIE', t);
    expect(found.map(e => e.view)).toContain('advertising');
  });

  it('trouve un écran par le nom de son module', () => {
    const found = searchCommands(entries, 'socle', t).map(e => e.view);
    expect(found).toContain('foundation');
    expect(found).toContain('graph');
  });

  it('trouve un module par son numéro', () => {
    const found = searchCommands(entries, '14', t);
    expect(found[0]?.view).toBe('deliverables');
  });

  it('exige chaque mot de la requête', () => {
    const found = searchCommands(entries, 'bornes appli', t);
    expect(found.map(e => e.view)).toEqual(['kiosk-app']);
    expect(searchCommands(entries, 'bornes zzz', t)).toHaveLength(0);
  });

  it('fait passer devant un libellé qui commence par la requête', () => {
    const found = searchCommands(entries, 'budget', t);
    expect(found[0]?.view).toBe('budget');
  });
});

describe('La pastille du projet', () => {
  it('prend deux initiales', () => {
    expect(siteInitials('Centre Grand-Sud')).toBe('CG');
    expect(siteInitials('hôpital')).toBe('H');
    expect(siteInitials('  gare  du nord ')).toBe('GD');
  });
});
