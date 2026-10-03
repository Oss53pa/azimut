import type { BindingCatalogue, BindingValues, SiteData, SiteFact } from '@azimut/core-model';
import {
  factValueText, isParkingZone, isParkingSpaceFootprint, declaredInteger, PARKING_CAPACITY_KEY, PARKING_FREE_KEY, PARKING_UNDIGITIZED_SPACES_KEY, codePointCompare,
} from '@azimut/core-model';

/**
 * Ce qu'un document de stratégie peut lier — A5.11, règle M01.S11.
 *
 * Le catalogue et les valeurs se construisent ensemble et volontairement : le
 * catalogue dit ce que le modèle sait offrir, les valeurs disent ce que ce
 * site-là en porte. Un champ catalogué sans valeur est une donnée à saisir ; un
 * champ hors catalogue est une faute du document. Les séparer ici évite que
 * `resolveBoundParagraph` ait à deviner.
 *
 * Les faits du site entrent par leur clé : un document lie `site_fact` et la clé
 * du fait, ce qui fait que déclarer un fait nouveau l'expose au document sans
 * toucher à ce module.
 */
export type DocumentBindings = {
  readonly values: BindingValues;
  readonly catalogue: BindingCatalogue;
};

/** Champs du site, indépendants de ce qu'il porte. */
const SITE_FIELDS = ['name', 'country_code'] as const;

/**
 * Champs d'un parking. Catalogués même quand le site n'a pas de parking : le
 * modèle les offre, et c'est ce que le catalogue décrit.
 */
const PARKING_FIELDS = ['name', 'capacity', 'digitized_spaces', 'access'] as const;

const LEVEL_FIELDS = ['count'] as const;

export function buildDocumentBindings(
  site: SiteData,
  facts: readonly SiteFact[] = [],
): DocumentBindings {
  const values: Record<string, Record<string, string>> = {
    site: {
      name: site.site.name,
      country_code: site.site.country_code,
    },
    level: {
      count: String(site.levels.length),
    },
    parking: {},
    site_fact: {},
  };

  // Le premier parking par identifiant, faute d'un moyen de désigner lequel.
  // Un document qui parle de plusieurs parkings demandera une liaison indexée,
  // que ce module n'offre pas encore : mieux vaut ne rien rendre qu'un chiffre
  // pris au hasard dans la liste.
  const parkings = (site.zones ?? [])
    .filter(zone => isParkingZone(zone.kind))
    .sort((l, r) => codePointCompare(l.id, r.id));
  const first = parkings[0];
  if (first !== undefined) {
    // Le compte des places est celui des empreintes tracées : une empreinte
    // marquée non numérisée n'en est pas une, elle est la surface où le plan
    // s'arrête. Ce compte diffère donc de celui d'`auditParking`, qui totalise
    // aussi les places que ces marques déclarent. Deux questions, deux
    // comptes : « ce qui a été tracé » n'est pas « ce que le site a ».
    const spaces = new Set(site.footprints
      .filter(footprint => isParkingSpaceFootprint(footprint.kind))
      .map(footprint => footprint.id));
    const digitized = first.footprint_ids.filter(id => spaces.has(id)
      && declaredInteger(facts, PARKING_UNDIGITIZED_SPACES_KEY,
        { kind: 'footprint', id }) === null).length;

    const target = { kind: 'zone', id: first.id };
    const capacity = declaredInteger(facts, PARKING_CAPACITY_KEY, target);
    const free = facts.find(fact => fact.key === PARKING_FREE_KEY
      && fact.target?.kind === target.kind && fact.target.id === target.id);

    // Un champ que rien ne déclare reste vide, et non rempli d'un défaut. La
    // règle M01.S11 — « un nombre affiché dans un livrable provient d'un fait
    // ou d'un calcul » — refuse qu'un document annonce une capacité que
    // personne n'a déclarée, et « payant » est une annonce tout autant que
    // « gratuit ».
    values['parking'] = {
      name: first.name,
      ...(capacity === null ? {} : { capacity: String(capacity) }),
      digitized_spaces: String(digitized),
      ...(free === undefined ? {} : { access: free.value === true ? 'gratuit' : 'payant' }),
    };
  }

  // Le statut d'un fait n'est pas jugé ici, et c'est délibéré : ce module rend
  // des valeurs, il ne décide pas ce qui a le droit de paraître. La règle
  // M01.S11 — « un fait de statut `proposal` ne s'affiche jamais comme un
  // existant » — est opposée par `auditSiteFacts` en mode livrable, qui lève
  // `PARK.PROPOSAL_AS_EXISTING`. Deux gardes pour une règle finiraient par se
  // contredire, et c'est l'anomalie qui nomme le fait à réviser.
  const factFields: string[] = [];
  const factValues: Record<string, string> = {};
  for (const fact of [...facts].sort((l, r) => codePointCompare(l.key, r.key))) {
    factFields.push(fact.key);
    factValues[fact.key] = factValueText(fact.value);
  }
  values['site_fact'] = factValues;

  return {
    values,
    catalogue: {
      site: [...SITE_FIELDS],
      level: [...LEVEL_FIELDS],
      parking: [...PARKING_FIELDS],
      site_fact: factFields,
    },
  };
}
