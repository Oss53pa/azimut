import { describe, it, expect } from 'vitest';
import { isWorkColourHex } from '@azimut/core-model';
import { themePapier, stateColorsPapier, themeInstrument } from '@azimut/design-tokens';

/**
 * S9, version 17 — « `hex` : même notation que les jetons de la partie F, six
 * chiffres hexadécimaux précédés d'un croisillon, en majuscules ».
 *
 * **Pourquoi cet essai vit ici et non dans `core-model`.** Éprouver
 * l'acceptation demande une valeur conforme, c'est-à-dire une couleur, et A2.4
 * interdit d'en écrire une hors du fichier de jetons. La section ne dit pas
 * « une notation qui ressemble à celle des jetons », elle dit la leur : la
 * valeur de référence est donc un jeton, lu là où les jetons s'écrivent, et
 * l'essai est adossé au fichier qui fait foi plutôt qu'à une copie.
 *
 * Cela le rend aussi plus fort qu'un essai à valeur écrite : si un jeton de la
 * partie F cessait un jour de respecter cette notation, ou si la notation de
 * S9 en divergeait, il échouerait. Une valeur recopiée ne dirait rien de ce
 * lien, qui est pourtant ce que la section affirme.
 *
 * Les refus, eux, ne portent aucune couleur et s'éprouvent dans le paquet, au
 * plus près du prédicat.
 */

/** Tous les jetons de couleur de la partie F, les deux thèmes et les états. */
function jetonsDeCouleur(): readonly string[] {
  return [
    ...Object.values(themePapier),
    ...Object.values(themeInstrument),
    ...Object.values(stateColorsPapier),
  ];
}

describe('S9 — la couleur de travail emploie la notation des jetons de la partie F', () => {
  it('les jetons sont bien lus, sinon l’essai ne prouverait rien', () => {
    expect(jetonsDeCouleur().length).toBeGreaterThan(20);
  });

  it('tout jeton de couleur de la partie F est une valeur acceptable pour `hex`', () => {
    const refuses = jetonsDeCouleur().filter(valeur => !isWorkColourHex(valeur));
    expect(
      refuses,
      'Ces jetons de la partie F ne passent pas la notation de S9 :\n' + refuses.join('\n'),
    ).toEqual([]);
  });

  it('la même valeur en minuscules est refusée, et la casse est donc bien tenue', () => {
    // Le cas décisif. Sans lui, un prédicat insensible à la casse passerait
    // l'essai précédent, et deux écritures d'une même couleur feraient deux
    // valeurs distinctes pour un même objet coloré.
    const [premier] = jetonsDeCouleur();
    expect(premier).toBeDefined();
    if (premier === undefined) return;
    expect(isWorkColourHex(premier)).toBe(true);
    expect(isWorkColourHex(premier.toLowerCase())).toBe(false);
  });

  it('la forme à trois chiffres est refusée, comme le croisillon absent', () => {
    const [premier] = jetonsDeCouleur();
    if (premier === undefined) return;
    expect(isWorkColourHex(premier.slice(0, 4))).toBe(false);
    expect(isWorkColourHex(premier.slice(1))).toBe(false);
  });
});
