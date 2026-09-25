import { describe, it, expect } from 'vitest';
import {
  ACCESSIBLE_FUNCTION_KEY, DECLARED_PICTOGRAM_FUNCTIONS, isFunctionKeyShape,
  pictogramFunctionDeclaration, resolvePictogramFunction, pictogramFunctionFinding,
  ERROR_CATALOG,
} from '../index.js';
import type { Pictogram } from '../index.js';

/**
 * A5.4 — la désignation de fonction d'un pictogramme.
 *
 * « À quoi il sert, et non d'où il vient. C'est par elle qu'un moteur demande
 * le pictogramme d'accessibilité sans connaître son code. »
 *
 * Ce que cet essai tient : la forme du vocabulaire, la résolution dans ses
 * trois cas, et l'accord des deux codes avec le catalogue de D2.2.
 */

function picto(partiel: Partial<Pictogram> & { readonly id: string }): Pictogram {
  return {
    org_id: 'org-1',
    category_id: 'cat-1',
    source: 'rules_pack',
    standard_ref: 'à renseigner par l’expert normatif',
    svg_path: 'M0 0h10v10H0z',
    registry: 'safety',
    function_key: ACCESSIBLE_FUNCTION_KEY,
    ...partiel,
  };
}

describe('A5.4 — le vocabulaire des fonctions', () => {
  it('donne à chaque fonction la forme espace de noms, point, nom', () => {
    for (const declaration of DECLARED_PICTOGRAM_FUNCTIONS) {
      expect(isFunctionKeyShape(declaration.key), declaration.key).toBe(true);
    }
  });

  it('refuse une clé sans point, à deux points, ou dont une part est vide', () => {
    for (const mauvaise of ['accessible', 'access.sous.cle', '.accessible', 'access.', '', ' a.b']) {
      expect(isFunctionKeyShape(mauvaise), mauvaise).toBe(false);
    }
  });

  it('ne déclare aucune fonction deux fois', () => {
    const clés = DECLARED_PICTOGRAM_FUNCTIONS.map(d => d.key);
    expect(new Set(clés).size).toBe(clés.length);
  });

  it('porte la fonction d’accessibilité, dans le registre de sécurité', () => {
    // S-39 la demande là, et nulle part ailleurs : INV-3 cloisonne le registre.
    const déclaration = pictogramFunctionDeclaration(ACCESSIBLE_FUNCTION_KEY);
    expect(déclaration?.registry).toBe('safety');
  });

  it('ne rend rien pour une fonction que le vocabulaire ne porte pas', () => {
    expect(pictogramFunctionDeclaration('service.restroom')).toBeNull();
  });
});

describe('A5.4 — la résolution d’une fonction', () => {
  const désigné = picto({ id: 'p-1' });

  it('rend le pictogramme quand un seul porte la fonction', () => {
    const r = resolvePictogramFunction([désigné], 'safety', ACCESSIBLE_FUNCTION_KEY);
    expect(r).toEqual({ kind: 'designated', pictogram: désigné });
  });

  it('dit qu’aucun ne la porte quand la liste est vide ou muette', () => {
    for (const jeu of [[], [picto({ id: 'p-2', function_key: null })]]) {
      expect(resolvePictogramFunction(jeu, 'safety', ACCESSIBLE_FUNCTION_KEY).kind)
        .toBe('not_designated');
    }
  });

  it('ne traverse pas le cloisonnement des registres', () => {
    // Un pictogramme d'orientation qui porterait la même fonction n'est pas
    // celui qu'une règle de sécurité demande. INV-3.
    const orientation = picto({ id: 'p-3', registry: 'wayfinding' });
    expect(resolvePictogramFunction([orientation], 'safety', ACCESSIBLE_FUNCTION_KEY).kind)
      .toBe('not_designated');
    expect(resolvePictogramFunction([orientation], 'wayfinding', ACCESSIBLE_FUNCTION_KEY).kind)
      .toBe('designated');
  });

  it('écarte un pictogramme au tracé vide plutôt que de rendre un dessin nul', () => {
    const creux = picto({ id: 'p-4', svg_path: '   ' });
    expect(resolvePictogramFunction([creux], 'safety', ACCESSIBLE_FUNCTION_KEY).kind)
      .toBe('not_designated');
  });

  it('ne départage pas deux pictogrammes qui portent la même fonction', () => {
    // « Une fonction est désignée au plus une fois par registre et par site. »
    // A7 : un moteur qui reçoit une entrée qu'il ne peut pas traiter refuse.
    const r = resolvePictogramFunction(
      [picto({ id: 'p-b' }), picto({ id: 'p-a' })], 'safety', ACCESSIBLE_FUNCTION_KEY,
    );
    expect(r.kind).toBe('ambiguous');
    // Triés : deux compilations d'un même état donnent la même anomalie, INV-4.
    expect(r.kind === 'ambiguous' ? r.ids : []).toEqual(['p-a', 'p-b']);
  });
});

describe('A5.4 — ce que la résolution oppose au moteur', () => {
  const sans = resolvePictogramFunction([], 'safety', ACCESSIBLE_FUNCTION_KEY);
  const deux = resolvePictogramFunction(
    [picto({ id: 'p-a' }), picto({ id: 'p-b' })], 'safety', ACCESSIBLE_FUNCTION_KEY,
  );

  it('n’oppose rien quand la fonction est désignée', () => {
    const r = resolvePictogramFunction([picto({ id: 'p-1' })], 'safety', ACCESSIBLE_FUNCTION_KEY);
    expect(pictogramFunctionFinding(r, 'safety', ACCESSIBLE_FUNCTION_KEY, 'S-39')).toBeNull();
  });

  it('avertit quand aucun pictogramme ne la porte', () => {
    const f = pictogramFunctionFinding(sans, 'safety', ACCESSIBLE_FUNCTION_KEY, 'S-39');
    expect(f?.code).toBe('PICTO.FUNCTION_NOT_DESIGNATED');
    expect(f?.severity).toBe('warning');
    expect(f?.params['function_key']).toBe(ACCESSIBLE_FUNCTION_KEY);
  });

  it('bloque quand deux la portent, et nomme les deux', () => {
    const f = pictogramFunctionFinding(deux, 'safety', ACCESSIBLE_FUNCTION_KEY, 'S-39');
    expect(f?.code).toBe('PICTO.FUNCTION_AMBIGUOUS');
    expect(f?.severity).toBe('blocking');
    expect(f?.params['pictogram_ids']).toBe('p-a,p-b');
  });

  it('donne à chaque code la gravité que le catalogue lui donne', () => {
    // D2.2 : le catalogue est clos et fait foi. Un code émis avec une gravité
    // autre que la sienne ferait mentir le catalogue.
    for (const résolution of [sans, deux]) {
      const f = pictogramFunctionFinding(résolution, 'safety', ACCESSIBLE_FUNCTION_KEY, 'S-39');
      if (f === null) continue;
      expect(ERROR_CATALOG[f.code as keyof typeof ERROR_CATALOG]?.severity).toBe(f.severity);
    }
  });
});
