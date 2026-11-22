/**
 * S6.6c — l'état sur lequel un brouillon a été commencé.
 *
 * La coquille relit le site quand un autre poste écrit. Un formulaire qui
 * tirerait alors son `before` du site relu ferait passer son brouillon par-
 * dessus l'écriture de l'autre, sans refus : le contrôle d'état de S6.2 ne
 * verrait rien. Le brouillon garde donc sa base, la commande part sur elle,
 * et une base dépassée est refusée en 409 (S6.2), jusqu'à S6.4 qui verrouille
 * l'objet en cours d'édition (S-20).
 *
 * Ce fichier dit seulement si l'objet a changé sous le brouillon. Pur.
 */
import type { ContentBlockInstance, SupportFace } from '@azimut/core-model';

const langsOf = (face: SupportFace): string => JSON.stringify(face.langs ?? []);

/** Vrai si la face en base n'est plus celle sur laquelle le brouillon est parti. */
export function faceChangedUnder(base: SupportFace | undefined, current: SupportFace | undefined): boolean {
  if (base === undefined || current === undefined) return base !== current;
  return base.id !== current.id
    || (base.template_key ?? null) !== (current.template_key ?? null)
    || langsOf(base) !== langsOf(current);
}

/** Vrai si le bloc a été réécrit ou retiré depuis le début de la saisie. */
export function blockChangedUnder(base: ContentBlockInstance, current: ContentBlockInstance | undefined): boolean {
  if (current === undefined) return true;
  return JSON.stringify(base.free_text ?? null) !== JSON.stringify(current.free_text ?? null);
}
