import type { CharterRule, Finding, ForbiddenCharacterRange, SiteData } from '@azimut/core-model';
import { resolveForbiddenCharacters, codePointCompare } from '@azimut/core-model';
import { checkableTexts } from './site-texts.js';

/**
 * Caractères interdits dans un texte de livrable — A5.8.
 *
 * `charter_rule` porte la nature `forbidden_character`, et D2.2 nomme
 * l'anomalie « Caractère interdit **par la charte** dans un texte de
 * livrable ». La règle appartient donc à la charte d'un client, et non au
 * produit : c'est l'arbitrage de l'éditeur, et il renverse celui que ce module
 * portait — il tenait la liste pour une règle de rédaction valant pour tout
 * livrable Azimut.
 *
 * **La liste vient désormais de la charte du site**, qui entre dans la
 * signature de ce contrôle. Aucun caractère n'est écrit ici.
 *
 * Trois issues, et le rapport les distingue. La charte ne porte pas la règle :
 * le contrôle ne s'exécute pas, `declared` est faux, l'appelant le range parmi
 * les non exercés, et aucune valeur par défaut n'est appliquée — « une règle
 * absente n'est pas une règle permissive ». La charte la porte et elle se lit :
 * le contrôle juge. La charte la porte et elle ne se lit pas : le contrôle
 * lève `CHARTER.RULE_MALFORMED`, bloquant, et **n'est pas rangé parmi les non
 * exercés** : il a lu la charte et l'a refusée.
 *
 * **Ce n'est pas une valeur d'origine normative.** Aucune norme ne décide
 * qu'un tiret cadratin est interdit. INV-5 ne la vise pas, et aucun paquet de
 * règles n'a à la porter.
 *
 * **Le contrôle porte sur la source, pas sur le rendu**, pour la raison que le
 * contrôle du lexique donne déjà : un caractère fautif dans une dénomination
 * se propage à chaque face et à chaque plan qui la cite. Le signaler une fois
 * sur la dénomination dit quoi corriger ; le signaler sur douze panneaux dit
 * seulement où le mal s'est répandu.
 */

export type TypographyReport = {
  /**
   * Nombre de textes réellement parcourus.
   *
   * Même raison que pour le lexique : sans ce compte, un rapport à zéro
   * anomalie ne se distingue pas d'un rapport qui n'avait rien à lire.
   */
  readonly checked_texts: number;
  /**
   * Vrai dès que la charte porte une règle de cette nature, lisible ou non.
   *
   * C'est lui qui décide du rangement chez l'appelant. Une règle cassée est
   * déclarée : la ranger parmi les non exercés cacherait qu'un site a une
   * charte et qu'elle ne produit rien.
   */
  readonly declared: boolean;
  /**
   * Vrai quand le contrôle a réellement jugé les textes.
   *
   * Un rapport non appliqué n'est pas un rapport vert. C'est la distinction
   * qu'A5.8 exige et que `checked_texts` seul ne rend pas : un site sans
   * charte lit bien ses textes, il n'a rien à leur opposer.
   */
  readonly applied: boolean;
  readonly findings: readonly Finding[];
};

function forbiddenAt(
  ranges: readonly ForbiddenCharacterRange[],
  codePoint: number,
): ForbiddenCharacterRange | null {
  for (const range of ranges) {
    if (codePoint >= range.from && codePoint <= range.to) return range;
  }
  return null;
}

/**
 * Le texte libre d'un gabarit de face.
 *
 * Il entre ici alors qu'il reste hors du corpus des contrôles de vocabulaire,
 * et la différence tient à une seule chose : juger un mot demande de savoir
 * dans quelle langue on le juge, juger un caractère non. Un tiret cadratin est
 * interdit en français comme en anglais. C'est aussi l'endroit où la règle a le
 * plus de chances d'être enfreinte, puisque c'est le seul texte qu'on saisit
 * librement.
 */
export function templateFreeTexts(site: SiteData): readonly { id: string; value: string }[] {
  const out: { id: string; value: string }[] = [];
  const templates = [...site.face_templates].sort((a, b) => codePointCompare(a.id, b.id));
  for (const template of templates) {
    // Par rang, comme l'annonce l'ordre déterministe : rien ne garantit que le
    // tableau des blocs arrive trié de la base.
    const blocks = [...template.blocks].sort((a, b) => a.ordinal - b.ordinal);
    for (const block of blocks) {
      if (block.kind !== 'free_text') continue;
      const text = block.config['text'];
      if (typeof text !== 'string' || text === '') continue;
      out.push({ id: `${template.id}#${String(block.ordinal)}`, value: text });
    }
  }
  return out;
}

/**
 * Parcourt les textes du site et rend une anomalie par caractère interdit.
 *
 * Une anomalie par occurrence, et non une par texte : deux fautes dans une même
 * dénomination sont deux corrections à faire, et un compte agrégé obligerait à
 * relire le texte pour savoir lesquelles.
 *
 * Ordre déterministe : les dénominations par identifiant, puis les textes
 * libres de gabarit par identifiant de gabarit et rang de bloc, et dans chaque
 * texte par position croissante.
 */
export function auditTypography(
  site: SiteData,
  charterRules: readonly CharterRule[],
): TypographyReport {
  const named = checkableTexts(site).map((t) => ({
    id: t.id, kind: t.kind, value: t.value,
  }));
  const free = templateFreeTexts(site).map((t) => ({
    id: t.id, kind: 'face_template_block', value: t.value,
  }));
  const texts = [...named, ...free];

  const resolved = resolveForbiddenCharacters(charterRules);
  const findings: Finding[] = [...resolved.findings];
  const ranges = resolved.value;
  if (ranges === null) {
    return {
      checked_texts: texts.length,
      declared: resolved.declared,
      applied: false,
      findings,
    };
  }

  for (const text of texts) {
    let position = 0;
    for (const char of text.value) {
      const code = char.codePointAt(0) ?? 0;
      const range = forbiddenAt(ranges, code);
      if (range !== null) {
        findings.push({
          code: 'LAYOUT.FORBIDDEN_CHARACTER',
          severity: 'blocking',
          entity: { kind: text.kind, id: text.id },
          params: {
            character: char,
            code_point: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
            name: range.name,
            position,
          },
          ruleRef: 'A5.8',
        });
      }
      position += char.length;
    }
  }

  return { checked_texts: texts.length, declared: true, applied: true, findings };
}
