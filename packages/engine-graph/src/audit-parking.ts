import type {
  Finding, Footprint, SiteZone, SiteFact,
} from '@azimut/core-model';
import {
  isParkingZone, isParkingSpaceFootprint, declaredInteger,
  PARKING_CAPACITY_KEY, PARKING_UNDIGITIZED_SPACES_KEY,
  PUBLISHABLE_FACT_STATUSES,
} from '@azimut/core-model';

/**
 * Contrôle du stationnement — section S8, règles S-35 à S-37.
 *
 * « Une place de stationnement est une empreinte de nature `parking_space`. Un
 * parking est une zone de nature `parking`. Ce sont les objets du socle,
 * module 01. » (S-35)
 *
 * « La capacité annoncée d'un parking est un fait du site, avec sa source et
 * son statut, section A5.11. Les contrôles du domaine `PARK` comparent le
 * compte des empreintes de nature `parking_space` à ce fait déclaré. » (S-36)
 *
 * « Une surface de parking non numérisée se déclare comme telle : une empreinte
 * de nature `parking_space` peut être marquée non numérisée, avec le nombre de
 * places qu'elle est censée porter et sa source. C'est elle qui explique un
 * écart entre la capacité annoncée et les places comptées. Sans explication
 * déclarée, l'écart lève `PARK.CAPACITY_UNEXPLAINED` ; avec elle, l'écart est
 * admis à concurrence des places déclarées. » (S-37)
 *
 * **Ce que ce module lisait avant, et pourquoi il ne le lit plus.** Il lisait
 * trois tables d'un module de stationnement — `parking`, `parking_space`,
 * `parking_uncovered_area` — que la section S8 rend redondantes : la première
 * doublait `zone`, la deuxième doublait `footprint`, la troisième portait ce
 * qu'un fait ciblé porte désormais. Les trois sont retirées ; ce contrôle lit
 * les objets du socle et les faits d'A5.11.
 *
 * **Ce que la marque d'une empreinte non numérisée est devenue.** Non plus une
 * table, mais l'existence du fait `parking.undigitized_spaces` qui désigne
 * l'empreinte. Une empreinte marquée ne vaut donc pas une place : elle vaut le
 * nombre que le fait déclare. C'est ce qui rend l'écart quantitatif — « admis à
 * concurrence des places déclarées » — là où la zone non couverte le rendait
 * seulement excusable.
 *
 * **Ce que la disparition du statut d'objet emporte.** `parking` et
 * `parking_space` portaient un statut et une source ; `zone` et `footprint`
 * d'A5.2 n'en portent aucun. Un parking « retiré » n'existe donc plus comme
 * état : une place retirée du plan est une empreinte effacée. En revanche
 * `PARK.PROPOSAL_AS_EXISTING` garde tout son sens, et se déplace sur le fait,
 * où A5.11 le pose : « un fait de statut `proposal` ne s'affiche jamais comme
 * un existant ».
 *
 * L'asymétrie reste celle qu'elle a toujours été. Numériser moins qu'annoncé
 * est recevable **à condition de l'avoir déclaré**, numériser plus ne l'est
 * jamais : un dépassement ne s'explique par aucune surface non numérisée ; il
 * dit que la capacité annoncée est fausse, ou qu'une place a été comptée deux
 * fois.
 */
export type ParkingReport = {
  readonly parking_count: number;
  readonly space_count: number;
  readonly findings: readonly Finding[];
};

export type ParkingInput = {
  /** Toutes les zones du site. Le contrôle retient celles de nature `parking`. */
  readonly zones: readonly SiteZone[];
  /** Toutes les empreintes. Le contrôle retient celles de nature `parking_space`. */
  readonly footprints: readonly Footprint[];
  /** Les faits déclarés du site, section A5.11. */
  readonly facts: readonly SiteFact[];
};

/** Les places d'un parking, et ce qu'elles totalisent une fois les marques lues. */
type Counted = {
  readonly spaces: number;
  readonly total: number;
};

/**
 * Ce que les empreintes d'un parking totalisent.
 *
 * Une empreinte ordinaire vaut une place. Une empreinte marquée non numérisée
 * vaut le nombre que son fait déclare, et non un : c'est une surface, pas un
 * emplacement. Un fait de valeur nulle ou négative ne peut pas venir de la
 * base — la clé déclare un entier, et rien n'écrit un compte négatif — mais le
 * total s'en protège, faute de quoi une marque mal saisie réduirait la
 * capacité expliquée au lieu de l'augmenter.
 */
function countSpaces(
  ids: readonly string[],
  spaces: ReadonlyMap<string, Footprint>,
  facts: readonly SiteFact[],
): Counted {
  let spaceCount = 0;
  let total = 0;
  for (const id of ids) {
    if (!spaces.has(id)) continue;
    spaceCount += 1;
    const declared = declaredInteger(
      facts, PARKING_UNDIGITIZED_SPACES_KEY, { kind: 'footprint', id },
    );
    total += declared === null ? 1 : Math.max(declared, 0);
  }
  return { spaces: spaceCount, total };
}

/**
 * Audite le stationnement d'un site.
 *
 * `forDeliverable` durcit le contrôle : hors livrable, une proposition est un
 * état de travail légitime ; portée à un livrable, elle s'afficherait comme un
 * fait, ce que refuse la règle M01.S11. Le même jeu de données est donc
 * acceptable à l'atelier et refusé à l'impression, et c'est voulu.
 */
export function auditParking(
  input: ParkingInput,
  forDeliverable = false,
): ParkingReport {
  const findings: Finding[] = [];

  const parkings = input.zones
    .filter(zone => isParkingZone(zone.kind))
    .sort((l, r) => l.id.localeCompare(r.id));
  const spaces = new Map(input.footprints
    .filter(footprint => isParkingSpaceFootprint(footprint.kind))
    .map(footprint => [footprint.id, footprint]));

  let spaceCount = 0;

  for (const parking of parkings) {
    const counted = countSpaces(parking.footprint_ids, spaces, input.facts);
    spaceCount += counted.spaces;

    const declared = declaredInteger(
      input.facts, PARKING_CAPACITY_KEY, { kind: 'zone', id: parking.id },
    );
    // Aucune capacité annoncée : rien à comparer. S-36 fait du fait le terme de
    // la comparaison, et un parking dont personne n'a annoncé la capacité n'est
    // pas en écart — il est sans annonce.
    if (declared === null) continue;

    if (counted.total > declared) {
      findings.push({
        code: 'PARK.CAPACITY_EXCEEDED',
        severity: 'blocking',
        entity: { kind: 'zone', id: parking.id },
        params: { digitised: counted.total, declared },
        ruleRef: 'S-36',
      });
    } else if (counted.total < declared) {
      findings.push({
        code: 'PARK.CAPACITY_UNEXPLAINED',
        severity: 'blocking',
        entity: { kind: 'zone', id: parking.id },
        params: {
          digitised: counted.total,
          declared,
          missing: declared - counted.total,
        },
        ruleRef: 'S-37',
      });
    }
  }

  if (forDeliverable) {
    findings.push(...unpublishableFacts(parkings, spaces, input.facts));
  }

  return {
    parking_count: parkings.length,
    space_count: spaceCount,
    findings,
  };
}

/**
 * Les faits de stationnement qu'un livrable n'a pas le droit d'afficher.
 *
 * A5.11 : « Un fait de statut `proposal` ne s'affiche jamais comme un
 * existant. » `to_verify` tombe du même côté, et pour une raison plus forte :
 * une valeur qu'on n'a pas pu confirmer, affichée sans réserve, se lit comme
 * une valeur confirmée.
 *
 * L'anomalie désigne l'objet, non le fait : c'est le parking ou la place que
 * le livrable montre, et c'est là que le lecteur doit regarder. La clé et le
 * statut sont en paramètres, pour que le chemin de correction — réviser le
 * fait — reste visible.
 */
function unpublishableFacts(
  parkings: readonly SiteZone[],
  spaces: ReadonlyMap<string, Footprint>,
  facts: readonly SiteFact[],
): readonly Finding[] {
  const targets = new Map<string, string>();
  for (const parking of parkings) targets.set(parking.id, 'zone');
  for (const id of spaces.keys()) targets.set(id, 'footprint');

  return facts
    .filter(fact => fact.target !== undefined
      && targets.get(fact.target.id) === fact.target.kind
      && !PUBLISHABLE_FACT_STATUSES.includes(fact.status))
    .map(fact => ({
      code: 'PARK.PROPOSAL_AS_EXISTING',
      severity: 'blocking' as const,
      entity: { kind: fact.target?.kind ?? '', id: fact.target?.id ?? '' },
      params: { status: fact.status, key: fact.key },
      ruleRef: 'M01.S11',
    }))
    .sort((l, r) => l.entity.id.localeCompare(r.entity.id)
      || String(l.params['key']).localeCompare(String(r.params['key'])));
}
