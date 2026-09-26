import { empreinteOutcome } from '@azimut/core-model';
import type { Outcome } from '@azimut/core-model';

/**
 * D3.2, D3.4 et D7.2 — l'empreinte d'un paquet de règles.
 *
 * Elle est calculée ici et nulle part ailleurs : le chargeur de répertoire la
 * compare au `checksum` du manifeste, le chargeur d'un paquet en un seul
 * document la rend comme identité du paquet, et les deux passent par cette
 * fonction.
 *
 * Elle porte sur le contenu des fichiers de règles, lus comme JSON, dans
 * l'ordre du manifeste, chacun avec son nom : la forme canonique commune à
 * toutes les empreintes (clés triées, NFC, champ absent omis, `sha256:`). Deux
 * écritures d'un même fichier, espaces ou ordre des clés, donnent la même
 * empreinte ; un changement de règle, de nom ou d'ordre de fichier la change.
 * Un paquet en un seul document n'a pas de nom de fichier : le champ est
 * absent, donc omis.
 *
 * Avant la version 26, l'empreinte était le condensé des octets des fichiers
 * mis bout à bout. Un manifeste écrit sous cette forme ne la retrouve plus et
 * son paquet est refusé par `RULES.PACK_CHECKSUM_MISMATCH` : le `checksum` se
 * réécrit, il ne se convertit pas.
 */
export type RulesPackDocument = {
  /** Nom du fichier au manifeste ; absent pour un paquet en un seul document. */
  readonly name?: string;
  /** Contenu du fichier, déjà lu comme JSON. */
  readonly content: unknown;
};

export function rulesPackEmpreinte(
  documents: readonly RulesPackDocument[],
  packKey: string,
): Outcome<string> {
  return empreinteOutcome(
    { files: documents.map(d => (d.name === undefined ? { content: d.content } : { name: d.name, content: d.content })) },
    { kind: 'rules_pack', id: packKey },
  );
}

/**
 * Lit les fichiers d'un paquet de répertoire, dans l'ordre du manifeste, et en
 * rend l'empreinte. Un fichier illisible est refusé par `RULES.INVALID_JSON`,
 * nommé ; un fichier absent ne se présente pas ici, le chargeur l'ayant déjà
 * refusé par `RULES.FILE_MISSING`.
 */
export function computeRulesPackChecksum(
  packKey: string,
  files: readonly string[],
  contents: Readonly<Record<string, string>>,
): Outcome<string> {
  const documents: RulesPackDocument[] = [];
  for (const name of files) {
    const text = contents[name];
    if (text === undefined) continue;
    let content: unknown;
    try {
      content = JSON.parse(text);
    } catch {
      return {
        ok: false,
        findings: [{
          code: 'RULES.INVALID_JSON',
          severity: 'blocking',
          entity: null,
          params: { file: name },
          ruleRef: null,
        }],
      };
    }
    documents.push({ name, content });
  }
  return rulesPackEmpreinte(documents, packKey);
}
