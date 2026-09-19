import type { Finding, SiteData } from '@azimut/core-model';
import { checkableTexts } from './site-texts.js';

/**
 * QC-06 — caractères interdits dans un livrable (complément atelier).
 *
 * Le principe P7 (complément atelier) dit « Rédaction propre. Aucun tiret
 * cadratin ou demi-cadratin, point médian, flèche, signe de multiplication,
 * points de suspension dans un livrable », et QC-06 en fait un contrôle
 * bloquant. Rien ne l'exerçait.
 *
 * **Ce n'est pas une valeur d'origine normative.** Aucune norme ne décide
 * qu'un tiret cadratin est interdit : c'est une règle de rédaction du produit,
 * énoncée par le document lui-même, au même titre que la mention d'auteur ou
 * le présent de l'indicatif. Elle ne relève donc pas d'un paquet de règles
 * (INV-5), et elle ne relève pas non plus du lexique de charte (A5.8), qui est
 * propre à un client quand celle-ci vaut pour tout livrable Azimut.
 *
 * **Le contrôle porte sur la source, pas sur le rendu**, pour la raison que le
 * contrôle du lexique donne déjà : un caractère fautif dans une dénomination
 * se propage à chaque face et à chaque plan qui la cite. Le signaler une fois
 * sur la dénomination dit quoi corriger ; le signaler sur douze panneaux dit
 * seulement où le mal s'est répandu.
 */

export type ForbiddenCharacterRange = {
  /** Premier point de code visé, inclus. */
  readonly from: number;
  /** Dernier point de code visé, inclus. Égal à `from` pour un caractère seul. */
  readonly to: number;
  /** Le nom que le document emploie, rapporté tel quel dans l'anomalie. */
  readonly name: string;
};

/**
 * La liste de QC-06, traduite en points de code.
 *
 * Le document nomme les caractères en termes typographiques français ; les
 * ramener à des points de code est une traduction, et elle est écrite ici pour
 * qu'un lecteur puisse la vérifier plutôt que de la croire.
 *
 * Deux limites assumées, faute de quoi le contrôle inventerait la règle qu'il
 * applique :
 *
 * - « points de suspension » vise le caractère U+2026, non trois points ASCII
 *   à la suite. Les deux se lisent pareil et ne sont pas la même chaîne ;
 *   étendre à « ... » ajouterait à la règle au lieu de l'appliquer ;
 * - « flèche » vise le bloc Unicode des flèches, U+2190 à U+21FF. Les blocs
 *   supplémentaires (U+27F0, U+2B00) n'y sont pas : aucun texte du dépôt n'en
 *   produit, et les ajouter le jour où l'un apparaît coûtera une ligne.
 */
export const FORBIDDEN_CHARACTERS: readonly ForbiddenCharacterRange[] = [
  { from: 0x00b7, to: 0x00b7, name: 'point médian' },
  { from: 0x00d7, to: 0x00d7, name: 'signe de multiplication' },
  { from: 0x2013, to: 0x2013, name: 'tiret demi-cadratin' },
  { from: 0x2014, to: 0x2014, name: 'tiret cadratin' },
  { from: 0x2026, to: 0x2026, name: 'points de suspension' },
  { from: 0x2190, to: 0x21ff, name: 'flèche' },
];

export type TypographyReport = {
  /**
   * Nombre de textes réellement parcourus.
   *
   * Même raison que pour le lexique : sans ce compte, un rapport à zéro
   * anomalie ne se distingue pas d'un rapport qui n'avait rien à lire.
   */
  readonly checked_texts: number;
  readonly findings: readonly Finding[];
};

function forbiddenAt(codePoint: number): ForbiddenCharacterRange | null {
  for (const range of FORBIDDEN_CHARACTERS) {
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
function templateFreeTexts(site: SiteData): readonly { id: string; value: string }[] {
  const out: { id: string; value: string }[] = [];
  const templates = [...site.face_templates].sort((a, b) => a.id.localeCompare(b.id));
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
export function auditTypography(site: SiteData): TypographyReport {
  const named = checkableTexts(site).map((t) => ({
    id: t.id, kind: t.kind, value: t.value,
  }));
  const free = templateFreeTexts(site).map((t) => ({
    id: t.id, kind: 'face_template_block', value: t.value,
  }));
  const texts = [...named, ...free];

  const findings: Finding[] = [];
  for (const text of texts) {
    let position = 0;
    for (const char of text.value) {
      const code = char.codePointAt(0) ?? 0;
      const range = forbiddenAt(code);
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
          ruleRef: 'atelier-QC-06',
        });
      }
      position += char.length;
    }
  }

  return { checked_texts: texts.length, findings };
}
