import type { BindingCatalogue, BindingValues, SiteData, SiteFact } from '@azimut/core-model';
import { PUBLISHABLE_STATUSES } from '@azimut/core-model';

/**
 * Ce qu'un document de stratégie peut lier — complément atelier, M15.
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
const PARKING_FIELDS = ['name', 'capacity', 'digitised_spaces', 'access'] as const;

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
  const parkings = [...site.parkings].sort((l, r) => l.id.localeCompare(r.id));
  const first = parkings[0];
  if (first !== undefined) {
    // Un document est un livrable : il ne compte que l'existant (P1). Une
    // proposition non validée s'y afficherait comme un fait, et le nombre de
    // places d'un parking est précisément le genre de fait qu'on cite ensuite
    // sans le revérifier.
    //
    // Ce compte diffère donc de celui de `auditParking`, qui mesure la
    // numérisation et retient aussi les propositions. Deux questions, deux
    // comptes : « ce qui a été tracé » n'est pas « ce que le site a ».
    const digitised = site.parking_spaces.filter(
      s => s.parking_id === first.id
        && PUBLISHABLE_STATUSES.includes(s.provenance.status),
    ).length;
    values['parking'] = {
      name: first.name,
      capacity: String(first.declared_capacity),
      digitised_spaces: String(digitised),
      access: first.free ? 'gratuit' : 'payant',
    };
  }

  const factFields: string[] = [];
  const factValues: Record<string, string> = {};
  for (const fact of [...facts].sort((l, r) => l.key.localeCompare(r.key))) {
    factFields.push(fact.key);
    factValues[fact.key] = fact.value;
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
