import type { SiteData } from '@azimut/core-model';

/**
 * Les textes du site qu'un contrôle de vocabulaire peut juger.
 *
 * Une seule définition, parce que deux contrôles les parcourent — le lexique de
 * charte et les faits du site — et qu'ils doivent porter sur le même ensemble.
 * Si l'un couvrait les dénominations et l'autre les blocs de face, une charte
 * propre et un fait respecté ne diraient plus la même chose du même livrable.
 *
 * **Ce que l'ensemble ne couvre pas encore**, et pourquoi : le texte libre d'un
 * bloc de face vient de la configuration du gabarit, en clair et sans langue
 * déclarée (`resolve-face`, cas `free_text`). Un contrôle de vocabulaire a
 * besoin de savoir dans quelle langue juger ; supposer le français reviendrait à
 * signaler des termes anglais dans un texte anglais. Ces blocs entreront ici le
 * jour où leur texte portera sa langue.
 */
export type CheckableText = {
  /** Identifiant de l'entité porteuse, rapporté tel quel dans l'anomalie. */
  readonly id: string;
  /** Nature de l'entité, pour l'anomalie : `destination_name`. */
  readonly kind: string;
  readonly lang: string;
  readonly value: string;
};

/** Parcours déterministe : par nature, puis par identifiant. */
export function checkableTexts(site: SiteData): readonly CheckableText[] {
  return [...site.destination_names]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((name) => ({
      id: name.id,
      kind: 'destination_name',
      lang: name.lang,
      value: name.value,
    }));
}
