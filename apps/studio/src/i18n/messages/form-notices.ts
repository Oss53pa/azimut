/**
 * D2.2 — les refus de saisie sans code au catalogue (`FormNotice`).
 *
 * Typées contre `FormNoticeKey` : une clé déclarée par le modèle sans
 * traduction ici ne compile pas.
 */
import type { FormNoticeKey } from '@azimut/core-model';

export const FORM_NOTICES_FR: Readonly<Record<FormNoticeKey, string>> = {
  'form.currency.invalid': 'Devise requise, en trois lettres majuscules (par exemple XOF).',
  'form.closure.edges.required': 'Choisir au moins une arête à fermer.',
  'form.closure.edge.unknown': 'Une arête choisie n’existe pas sur ce site.',
  'form.closure.range.invalid': 'Bornes attendues au format AAAA-MM-JJTHH:MM:SS, la fin après le début.',
  'form.closure.reason.required': 'Indiquer le motif de la fermeture.',
  'form.face.support.unknown': 'Ce support n’existe pas sur le site.',
  'form.face.index.out_of_range': 'La typologie du support ne prévoit pas cette face.',
  'form.face.already_declared': 'Cette face est déjà déclarée sur le support.',
  'form.face.template.unknown': 'Ce gabarit n’est pas connu du site.',
  'form.face.lang.inactive': 'Cette langue n’est pas active sur le site.',
  'form.block.slot.none': 'Le gabarit de la face n’a pas d’emplacement libre de ce type.',
  'form.block.slot.taken': 'Cet emplacement du gabarit est déjà rempli.',
  'form.block.template.not_at_hand': 'Gabarit inconnu du poste : l’emplacement n’a pas pu être vérifié.',
  'form.free_text.empty': 'Saisir le texte dans au moins une langue de la face.',
  'form.free_text.lang.outside_face': 'Texte saisi dans une langue que la face ne porte pas.',
  'form.free_text.lang.missing': 'Une langue de la face reste sans texte.',
};

export const FORM_NOTICES_EN: Readonly<Record<FormNoticeKey, string>> = {
  'form.currency.invalid': 'Currency required, as three capital letters (for example XOF).',
  'form.closure.edges.required': 'Choose at least one edge to close.',
  'form.closure.edge.unknown': 'A chosen edge does not exist on this site.',
  'form.closure.range.invalid': 'Bounds expected as YYYY-MM-DDTHH:MM:SS, the end after the start.',
  'form.closure.reason.required': 'Give the reason for the closure.',
  'form.face.support.unknown': 'This support does not exist on the site.',
  'form.face.index.out_of_range': 'The support’s typology has no such face.',
  'form.face.already_declared': 'This face is already declared on the support.',
  'form.face.template.unknown': 'This template is not known to the site.',
  'form.face.lang.inactive': 'This language is not active on the site.',
  'form.block.slot.none': 'The face’s template has no free slot of this kind.',
  'form.block.slot.taken': 'This template slot is already filled.',
  'form.block.template.not_at_hand': 'Template unknown to this station: the slot could not be checked.',
  'form.free_text.empty': 'Enter the text in at least one of the face’s languages.',
  'form.free_text.lang.outside_face': 'Text entered in a language the face does not carry.',
  'form.free_text.lang.missing': 'One of the face’s languages has no text.',
};
