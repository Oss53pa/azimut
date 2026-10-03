import { describe, it, expect } from 'vitest';
import { sitesByName } from '../site-order.js';

const site = (id: string, name: string) => ({ id, name });

describe('A9 — les sites ordonnés pour l’affichage, dans la langue déclarée', () => {
  it('range les noms accentués à leur place de lecteur, non par points de code', () => {
    const sites = [site('s3', 'Zénith'), site('s1', 'Étoile'), site('s2', 'Arcades')];
    expect(sitesByName(sites, 'fr').map(s => s.name)).toEqual(['Arcades', 'Étoile', 'Zénith']);
  });

  it('départage deux noms égaux par l’identifiant, par points de code', () => {
    const sites = [site('s-b', 'Gare'), site('s-a', 'Gare')];
    expect(sitesByName(sites, 'fr').map(s => s.id)).toEqual(['s-a', 's-b']);
  });

  it('ne modifie pas la liste reçue', () => {
    const sites = [site('s2', 'B'), site('s1', 'A')];
    sitesByName(sites, 'en');
    expect(sites.map(s => s.id)).toEqual(['s2', 's1']);
  });
});
