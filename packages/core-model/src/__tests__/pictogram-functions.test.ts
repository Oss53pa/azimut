import { describe, it, expect } from 'vitest';
import {
  ACCESSIBLE_FUNCTION_KEY, DECLARED_PICTOGRAM_FUNCTIONS, isFunctionKeyShape,
  pictogramFunctionDeclaration, resolvePictogramFunction, pictogramFunctionFinding,
  siteScope, ERROR_CATALOG,
} from '../index.js';
import type { Pictogram, PictogramScope, SiteRulesBinding } from '../index.js';

/**
 * A5.4 — la désignation de fonction d'un pictogramme.
 *
 * « À quoi il sert, et non d'où il vient. C'est par elle qu'un moteur demande
 * le pictogramme d'accessibilité sans connaître son code. »
 *
 * Ce que cet essai tient : la forme du vocabulaire, la résolution dans ses
 * trois cas, et l'accord des deux codes avec le catalogue de D2.2.
 */

const PAQUET_A = 'paquet-a';
const PAQUET_B = 'paquet-b';

/** La portée de sécurité d'un site rattaché au paquet A. */
const SECU_A: PictogramScope = { registry: 'safety', rules_pack_ids: [PAQUET_A] };
const ORIENTATION: PictogramScope = { registry: 'wayfinding' };

function picto(partiel: Partial<Pictogram> & { readonly id: string }): Pictogram {
  return {
    org_id: 'org-1',
    category_id: 'cat-1',
    source: 'rules_pack',
    standard_ref: 'à renseigner par l’expert normatif',
    svg_path: 'M0 0h10v10H0z',
    registry: 'safety',
    function_key: ACCESSIBLE_FUNCTION_KEY,
    rules_pack_id: PAQUET_A,
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
    const r = resolvePictogramFunction([désigné], SECU_A, ACCESSIBLE_FUNCTION_KEY);
    expect(r).toEqual({ kind: 'designated', pictogram: désigné });
  });

  it('dit qu’aucun ne la porte quand la liste est vide ou muette', () => {
    for (const jeu of [[], [picto({ id: 'p-2', function_key: null })]]) {
      expect(resolvePictogramFunction(jeu, SECU_A, ACCESSIBLE_FUNCTION_KEY).kind)
        .toBe('not_designated');
    }
  });

  it('ne traverse pas le cloisonnement des registres', () => {
    // Un pictogramme d'orientation qui porterait la même fonction n'est pas
    // celui qu'une règle de sécurité demande. INV-3.
    const orientation = picto({ id: 'p-3', registry: 'wayfinding', rules_pack_id: null });
    expect(resolvePictogramFunction([orientation], SECU_A, ACCESSIBLE_FUNCTION_KEY).kind)
      .toBe('not_designated');
    expect(resolvePictogramFunction([orientation], ORIENTATION, ACCESSIBLE_FUNCTION_KEY).kind)
      .toBe('designated');
  });

  it('écarte un pictogramme au tracé vide plutôt que de rendre un dessin nul', () => {
    const creux = picto({ id: 'p-4', svg_path: '   ' });
    expect(resolvePictogramFunction([creux], SECU_A, ACCESSIBLE_FUNCTION_KEY).kind)
      .toBe('not_designated');
  });

  it('ne départage pas deux pictogrammes qui portent la fonction dans la même portée', () => {
    // A7 : un moteur qui reçoit une entrée qu'il ne peut pas traiter refuse.
    const r = resolvePictogramFunction(
      [picto({ id: 'p-b' }), picto({ id: 'p-a' })], SECU_A, ACCESSIBLE_FUNCTION_KEY,
    );
    expect(r.kind).toBe('ambiguous');
    // Triés : deux compilations d'un même état donnent la même anomalie, INV-4.
    expect(r.kind === 'ambiguous' ? r.ids : []).toEqual(['p-a', 'p-b']);
  });
});

describe('A5.4 — la portée d’unicité : le paquet pour la sécurité, l’organisation pour l’orientation', () => {
  // « Une organisation qui exploite deux sites rattachés à deux paquets
  // différents porte légitimement deux pictogrammes de même fonction, un par
  // paquet : l'unicité par organisation les déclarerait ambigus à tort. »
  const duPaquetA = picto({ id: 'p-pmr-a', rules_pack_id: PAQUET_A });
  const duPaquetB = picto({ id: 'p-pmr-b', rules_pack_id: PAQUET_B });
  const organisation = [duPaquetA, duPaquetB];

  it('ne déclare pas ambigus deux pictogrammes de même fonction portés par deux paquets', () => {
    expect(resolvePictogramFunction(organisation, SECU_A, ACCESSIBLE_FUNCTION_KEY))
      .toEqual({ kind: 'designated', pictogram: duPaquetA });
  });

  it('donne à chaque site le pictogramme de son propre paquet', () => {
    const scopeB: PictogramScope = { registry: 'safety', rules_pack_ids: [PAQUET_B] };
    expect(resolvePictogramFunction(organisation, scopeB, ACCESSIBLE_FUNCTION_KEY))
      .toEqual({ kind: 'designated', pictogram: duPaquetB });
  });

  it('ne donne rien au site d’un paquet qui ne désigne pas la fonction', () => {
    // Le pictogramme d'un autre paquet n'est pas un repli : il ne relève pas
    // des règles de ce site.
    const scopeC: PictogramScope = { registry: 'safety', rules_pack_ids: ['paquet-c'] };
    expect(resolvePictogramFunction(organisation, scopeC, ACCESSIBLE_FUNCTION_KEY).kind)
      .toBe('not_designated');
  });

  it('ne donne rien à un site sans paquet, pas même un pictogramme sans paquet', () => {
    // La désignation du registre de sécurité « vient du paquet de règles » :
    // sans paquet, elle ne vient de nulle part.
    const sansPaquet = picto({ id: 'p-orphelin', rules_pack_id: null });
    const scope: PictogramScope = { registry: 'safety', rules_pack_ids: [] };
    expect(resolvePictogramFunction([sansPaquet], scope, ACCESSIBLE_FUNCTION_KEY).kind)
      .toBe('not_designated');
  });

  it('tient l’orientation à l’organisation', () => {
    // Deux pictogrammes d'orientation de même fonction dans une organisation
    // se contredisent. Ils ne portent pas de paquet : A5.4, « le paquet reste
    // vide ».
    const deux = [
      picto({ id: 'o-1', registry: 'wayfinding', rules_pack_id: null }),
      picto({ id: 'o-2', registry: 'wayfinding', rules_pack_id: null }),
    ];
    const r = resolvePictogramFunction(deux, ORIENTATION, ACCESSIBLE_FUNCTION_KEY);
    expect(r).toEqual({ kind: 'ambiguous', ids: ['o-1', 'o-2'], rules_pack_id: null });
  });
});

describe('A5.8 — la surcouche l’emporte, l’ambiguïté se juge dans un paquet', () => {
  // « Précédence, pour une même fonction de pictogramme comme pour une
  // règle : la surcouche l'emporte sur le socle. L'ambiguïté ne se juge qu'à
  // l'intérieur d'un même paquet ; deux paquets qui désignent la même
  // fonction ne sont pas ambigus. »
  const SOCLE = 'paquet-socle';
  const SURCOUCHE = 'paquet-surcouche';
  const scope: PictogramScope = { registry: 'safety', rules_pack_ids: [SURCOUCHE, SOCLE] };
  const duSocle = picto({ id: 'p-socle', rules_pack_id: SOCLE });
  const deLaSurcouche = picto({ id: 'p-surcouche', rules_pack_id: SURCOUCHE });

  it('rend celui de la surcouche quand les deux paquets désignent la fonction', () => {
    expect(resolvePictogramFunction([duSocle, deLaSurcouche], scope, ACCESSIBLE_FUNCTION_KEY))
      .toEqual({ kind: 'designated', pictogram: deLaSurcouche });
  });

  it('descend au socle quand la surcouche ne la désigne pas', () => {
    expect(resolvePictogramFunction([duSocle], scope, ACCESSIBLE_FUNCTION_KEY))
      .toEqual({ kind: 'designated', pictogram: duSocle });
  });

  it('ignore une ambiguïté du socle quand la surcouche répond', () => {
    const second = picto({ id: 'p-socle-bis', rules_pack_id: SOCLE });
    expect(resolvePictogramFunction(
      [duSocle, second, deLaSurcouche], scope, ACCESSIBLE_FUNCTION_KEY,
    )).toEqual({ kind: 'designated', pictogram: deLaSurcouche });
  });

  it('s’arrête sur une ambiguïté de la surcouche, sans descendre au socle', () => {
    // Descendre masquerait une contradiction du paquet qui prime.
    const second = picto({ id: 'p-surcouche-bis', rules_pack_id: SURCOUCHE });
    expect(resolvePictogramFunction(
      [duSocle, deLaSurcouche, second], scope, ACCESSIBLE_FUNCTION_KEY,
    )).toEqual({
      kind: 'ambiguous', ids: ['p-surcouche', 'p-surcouche-bis'], rules_pack_id: SURCOUCHE,
    });
  });

  it('lit l’ordre des paquets sur les rattachements du site', () => {
    const rattachements: readonly SiteRulesBinding[] = [
      { id: 'rb-1', rules_pack_id: SOCLE, role: 'base' },
      { id: 'rb-2', rules_pack_id: SURCOUCHE, role: 'overlay' },
    ];
    expect(siteScope({ rules_bindings: rattachements }, 'safety'))
      .toEqual({ registry: 'safety', rules_pack_ids: [SURCOUCHE, SOCLE] });
    expect(siteScope({ rules_bindings: [] }, 'safety'))
      .toEqual({ registry: 'safety', rules_pack_ids: [] });
    expect(siteScope({ rules_bindings: rattachements }, 'wayfinding'))
      .toEqual({ registry: 'wayfinding' });
  });
});

describe('A5.4 — ce que la résolution oppose au moteur', () => {
  const sans = resolvePictogramFunction([], SECU_A, ACCESSIBLE_FUNCTION_KEY);
  const deux = resolvePictogramFunction(
    [picto({ id: 'p-a' }), picto({ id: 'p-b' })], SECU_A, ACCESSIBLE_FUNCTION_KEY,
  );

  it('n’oppose rien quand la fonction est désignée', () => {
    const r = resolvePictogramFunction([picto({ id: 'p-1' })], SECU_A, ACCESSIBLE_FUNCTION_KEY);
    expect(pictogramFunctionFinding(r, SECU_A, ACCESSIBLE_FUNCTION_KEY, 'S-39')).toBeNull();
  });

  it('avertit quand aucun pictogramme ne la porte, et nomme le paquet cherché', () => {
    const f = pictogramFunctionFinding(sans, SECU_A, ACCESSIBLE_FUNCTION_KEY, 'S-39');
    expect(f?.code).toBe('PICTO.FUNCTION_NOT_DESIGNATED');
    expect(f?.severity).toBe('warning');
    expect(f?.params).toEqual({
      function_key: ACCESSIBLE_FUNCTION_KEY, registry: 'safety', rules_pack_ids: PAQUET_A,
    });
  });

  it('bloque quand deux la portent, et nomme les deux', () => {
    const f = pictogramFunctionFinding(deux, SECU_A, ACCESSIBLE_FUNCTION_KEY, 'S-39');
    expect(f?.code).toBe('PICTO.FUNCTION_AMBIGUOUS');
    expect(f?.severity).toBe('blocking');
    expect(f?.params['pictogram_ids']).toBe('p-a,p-b');
    expect(f?.params['rules_pack_id']).toBe(PAQUET_A);
  });

  it('donne à chaque code la gravité que le catalogue lui donne', () => {
    // D2.2 : le catalogue est clos et fait foi. Un code émis avec une gravité
    // autre que la sienne ferait mentir le catalogue.
    for (const résolution of [sans, deux]) {
      const f = pictogramFunctionFinding(résolution, SECU_A, ACCESSIBLE_FUNCTION_KEY, 'S-39');
      if (f === null) continue;
      expect(ERROR_CATALOG[f.code as keyof typeof ERROR_CATALOG]?.severity).toBe(f.severity);
    }
  });
});
