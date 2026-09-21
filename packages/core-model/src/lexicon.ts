/**
 * Appariement d'un texte au lexique de la charte (A5.8, `lexicon_term`).
 *
 * La charte d'un site impose un vocabulaire : « visiteurs » et non « clients »,
 * « enseignes » et non « boutiques ». Les deux codes d'anomalie
 * `LAYOUT.LEXICON_FORBIDDEN_TERM` et `LAYOUT.LEXICON_DISCOURAGED_TERM` étaient
 * au catalogue depuis l'origine sans que rien ne les lève.
 *
 * Ce module ne rend que des appariements, avec leur position. Il ne décide pas
 * de ce qui est contrôlé, ni de ce qu'on en fait : `auditLexicon` s'en charge
 * côté moteur, et le même appariement servira aux mots interdits attachés à un
 * fait du site.
 */
import { transliterate } from './file-naming.js';

export type LexiconSeverity = 'forbidden' | 'discouraged';

export type LexiconTerm = {
  /** Langue à laquelle le terme s'applique. Un terme français ne juge pas un texte anglais. */
  readonly lang: string;
  readonly term: string;
  readonly severity: LexiconSeverity;
};

export type LexiconMatch = {
  readonly term: string;
  readonly severity: LexiconSeverity;
  /** Bornes dans le texte **d'origine**, accents et casse compris. */
  readonly start: number;
  readonly end: number;
};

type Normalized = {
  readonly text: string;
  /** Pour chaque caractère normalisé, son index dans le texte d'origine. */
  readonly sources: readonly number[];
};

/**
 * Replie casse et accents, en gardant le chemin du retour.
 *
 * La translittération n'est pas bijective en longueur : `Æ` devient `AE`, `ß`
 * devient `SS`. Comparer sur le texte replié puis rapporter l'index replié
 * désignerait la mauvaise position dès qu'un de ces caractères précède
 * l'anomalie. La table d'index évite cette classe d'erreur au lieu de parier
 * qu'elle ne se produira pas.
 */
function normalize(input: string): Normalized {
  let text = '';
  const sources: number[] = [];
  let index = 0;
  for (const ch of input) {
    const folded = transliterate(ch).toLowerCase();
    // Un caractère d'origine peut en produire plusieurs : chacun pointe vers lui.
    for (let k = 0; k < folded.length; k++) sources.push(index);
    text += folded;
    index += ch.length;
  }
  return { text, sources };
}

/**
 * Un caractère de mot, au sens de la frontière de terme. Le texte est déjà
 * replié quand cette fonction le voit : il ne reste ni accent ni majuscule.
 */
function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  return (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
}

/**
 * Cherche les termes du lexique dans un texte.
 *
 * **L'appariement porte sur des mots entiers.** « client » ne signale pas
 * « clientèle », et « caisse » ne signale pas « caissette ». C'est la règle
 * prévisible : un rédacteur peut la vérifier de tête, là où un appariement par
 * préfixe produirait des signalements qu'il ne pourrait ni prévoir ni faire
 * taire. La conséquence est qu'une charte énumère ses formes — « client » et
 * « clients » sont deux entrées — et le complément atelier procède déjà ainsi
 * quand il liste « paiement » et « payant » côte à côte.
 *
 * Un terme de plusieurs mots est apparié tel quel, ses frontières étant celles
 * de ses extrémités.
 *
 * L'ordre rendu est déterministe : par position, puis par terme.
 */
export function findLexiconMatches(
  text: string,
  terms: readonly LexiconTerm[],
  lang: string,
): readonly LexiconMatch[] {
  const haystack = normalize(text);
  const matches: LexiconMatch[] = [];

  for (const entry of terms) {
    if (entry.lang !== lang) continue;
    // Un terme est replié puis rogné : une entrée de charte vide, ou réduite à
    // des espaces, ne désigne aucun mot. Sans ce rognage elle s'apparierait à
    // toute suite d'espaces du texte et signalerait partout.
    const needle = normalize(entry.term).text.trim();
    if (needle === '') continue;

    let from = 0;
    for (;;) {
      const at = haystack.text.indexOf(needle, from);
      if (at === -1) break;
      from = at + 1;

      const before = at === 0 ? undefined : haystack.text[at - 1];
      const after = haystack.text[at + needle.length];
      if (isWordChar(before) || isWordChar(after)) continue;

      const start = haystack.sources[at];
      // Fin exclusive : l'index d'origine du caractère qui suit, ou la fin.
      const endIndex = at + needle.length;
      const end = endIndex >= haystack.sources.length
        ? text.length
        : (haystack.sources[endIndex] ?? text.length);
      if (start === undefined) continue;

      matches.push({ term: entry.term, severity: entry.severity, start, end });
    }
  }

  return matches.sort((left, right) =>
    left.start - right.start || left.term.localeCompare(right.term),
  );
}
