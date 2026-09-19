import { describe, it, expect } from 'vitest';
import { resolveBoundParagraph, literalNumbers } from '../bound-text.js';
import type { BoundParagraph, BindingValues } from '../bound-text.js';

/** Le paragraphe Stationnement du complément, en champs liés. */
const STATIONNEMENT: BoundParagraph = {
  id: 'p-stationnement',
  segments: [
    { kind: 'literal', text: 'Le ' },
    { kind: 'bound', binding: { source: 'parking', field: 'name' } },
    { kind: 'literal', text: ' compte ' },
    { kind: 'bound', binding: { source: 'parking', field: 'capacity' } },
    { kind: 'literal', text: ' places et son accès est ' },
    { kind: 'bound', binding: { source: 'site_fact', field: 'parking_gratuit' } },
    { kind: 'literal', text: '.' },
  ],
};

const VALEURS: BindingValues = {
  parking: { name: 'parking Ouest', capacity: '89' },
  site_fact: { parking_gratuit: 'gratuit' },
};

describe('resolveBoundParagraph (M15)', () => {
  it('rend la phrase depuis les valeurs, sans rien recopier', () => {
    const r = resolveBoundParagraph(STATIONNEMENT, VALEURS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toBe('Le parking Ouest compte 89 places et son accès est gratuit.');
  });

  it('suit un changement de valeur sans que le texte change', () => {
    // C'est l'exigence de M15 (complément atelier) : le relevé passe de 89 à 93, la phrase suit.
    const r = resolveBoundParagraph(STATIONNEMENT, {
      ...VALEURS,
      parking: { name: 'parking Ouest', capacity: '93' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toContain('93 places');
  });

  it('refuse le paragraphe entier quand une liaison manque', () => {
    // Ni marque de réservation, ni trou : « compte  places » se lirait
    // normalement et personne ne verrait le manque avant la réunion.
    const r = resolveBoundParagraph(STATIONNEMENT, {
      parking: { name: 'parking Ouest' },
      site_fact: { parking_gratuit: 'gratuit' },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing).toEqual([
      { binding: { source: 'parking', field: 'capacity' }, cause: 'empty' },
    ]);
  });

  it('nomme toutes les liaisons manquantes, pas seulement la première', () => {
    const r = resolveBoundParagraph(STATIONNEMENT, {});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing).toHaveLength(3);
  });

  it('sans catalogue, tout manque est réputé une absence de valeur', () => {
    // Le diagnostic le moins accusateur pour le document : on ne sait pas si le
    // champ existe, on ne l'accuse donc pas de ne pas exister.
    const r = resolveBoundParagraph(STATIONNEMENT, { parking: {}, site_fact: {} });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing.every(m => m.cause === 'empty')).toBe(true);
  });

  it('avec catalogue, distingue un champ inexistant d’un champ vide', () => {
    const faute: BoundParagraph = {
      id: 'p',
      segments: [
        { kind: 'bound', binding: { source: 'parking', field: 'capacite' } },
        { kind: 'bound', binding: { source: 'parking', field: 'capacity' } },
      ],
    };
    const r = resolveBoundParagraph(faute, { parking: {} }, { parking: ['capacity'] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // « capacite » n'existe pas : faute du document. « capacity » existe et le
    // site n'a rien à y mettre : donnée à saisir.
    expect(r.missing.map(m => m.cause)).toEqual(['unknown', 'empty']);
  });

  it('une source entière hors catalogue est une faute du document', () => {
    const r = resolveBoundParagraph(
      { id: 'p', segments: [{ kind: 'bound', binding: { source: 'inventee', field: 'x' } }] },
      {},
      { parking: ['capacity'] },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing[0]?.cause).toBe('unknown');
  });

  it('rend une valeur vide comme une valeur, pas comme un manque', () => {
    // Une chaîne vide est une réponse : le champ existe et ne dit rien.
    const r = resolveBoundParagraph(
      { id: 'p', segments: [{ kind: 'bound', binding: { source: 's', field: 'f' } }] },
      { s: { f: '' } },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toBe('');
  });

  it('rend un paragraphe sans liaison tel quel', () => {
    const r = resolveBoundParagraph(
      { id: 'p', segments: [{ kind: 'literal', text: 'Texte libre.' }] },
      {},
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toBe('Texte libre.');
  });
});

describe('literalNumbers (M15)', () => {
  it('ne voit aucun nombre quand tout est lié', () => {
    expect(literalNumbers(STATIONNEMENT)).toEqual([]);
  });

  it('voit un nombre recopié dans la phrase', () => {
    const recopie: BoundParagraph = {
      id: 'p',
      segments: [{ kind: 'literal', text: 'Le parking compte 89 places.' }],
    };
    expect(literalNumbers(recopie)).toEqual(['89']);
  });

  it('voit les décimales, virgule comme point', () => {
    const p: BoundParagraph = {
      id: 'p',
      segments: [{ kind: 'literal', text: 'Résidu de 0,25 m et pente de 2.5 pour cent.' }],
    };
    expect(literalNumbers(p)).toEqual(['0,25', '2.5']);
  });

  it('ne regarde pas dans les valeurs liées', () => {
    // La valeur rendue porte le nombre, et c'est justement ce qu'on veut.
    const p: BoundParagraph = {
      id: 'p',
      segments: [{ kind: 'bound', binding: { source: 'parking', field: 'capacity' } }],
    };
    expect(literalNumbers(p)).toEqual([]);
  });
});
