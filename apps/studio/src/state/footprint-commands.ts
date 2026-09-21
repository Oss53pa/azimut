/**
 * M3 (partie M) — écriture des empreintes, et duplication en série.
 *
 * « La duplication en série est l'action qui fait gagner le plus de temps sur
 * une galerie à trame régulière, elle est en évidence et non enfouie. »
 *
 * Critère d'acceptation 4 : « La duplication en série de 20 cellules se fait
 * en une commande annulable d'un seul geste. » Un geste, un groupe, une
 * annulation — c'est E5.2 appliqué au cas où il compte le plus : vingt
 * annulations successives pour défaire une seule action seraient une punition.
 */
import type { EntityCommand, Outcome, Point } from '@azimut/core-model';
import { buildCommand, quantizePoint } from '@azimut/core-model';
import type { AcceptedFootprint } from './footprint-input.js';

export type FootprintWrite = {
  readonly orgId: string;
  readonly levelId: string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

/** Une empreinte à écrire, avec son identifiant tiré par l'appelant. */
export type FootprintRow = {
  readonly id: string;
  readonly footprint: AcceptedFootprint;
};

/**
 * Les commandes de création d'une ou plusieurs empreintes, sous un seul geste.
 *
 * `groupKey` est fourni : c'est lui qui fait qu'une duplication de vingt
 * cellules s'annule d'un coup.
 */
export function createFootprintCommands(
  rows: readonly FootprintRow[],
  write: FootprintWrite,
  groupKey: string,
): Outcome<readonly EntityCommand[]> {
  const commands: EntityCommand[] = [];
  for (const row of rows) {
    const built = buildCommand({
      operation: 'create',
      module: '01-socle',
      table: 'footprint',
      id: row.id,
      org_id: write.orgId,
      after: {
        id: row.id,
        org_id: write.orgId,
        level_id: write.levelId,
        kind: row.footprint.kind,
        unit_code: row.footprint.unitCode,
        category_id: row.footprint.categoryId,
        geometry: JSON.stringify({ vertices: row.footprint.vertices }),
      },
      timestamp: write.timestamp,
      groupKey,
    });
    if (!built.ok) return { ok: false, findings: built.findings };
    commands.push(built.value);
  }
  return { ok: true, value: commands, warnings: [] };
}

// ---------------------------------------------------------------------------
// Duplication en série
// ---------------------------------------------------------------------------

/** Le pas d'une série : un vecteur, et le nombre de copies. */
export type SeriesStep = {
  readonly dx_m: number;
  readonly dy_m: number;
  readonly count: number;
};

/**
 * Les contours d'une duplication en série le long d'un axe.
 *
 * L'original n'est pas reproduit : la série ajoute `count` copies après lui.
 * Chaque copie est quantifiée (E4), et non translatée puis quantifiée à
 * l'écriture : la vingtième copie accumulerait sinon vingt fois l'erreur du
 * pas, et la trame ne serait plus régulière.
 */
export function seriesVertices(
  vertices: readonly Point[],
  step: SeriesStep,
): readonly (readonly Point[])[] {
  const copies: (readonly Point[])[] = [];
  for (let n = 1; n <= step.count; n += 1) {
    copies.push(vertices.map(v => quantizePoint({
      x_m: v.x_m + step.dx_m * n,
      y_m: v.y_m + step.dy_m * n,
    })));
  }
  return copies;
}

/**
 * Les codes d'une série, dérivés du code d'origine.
 *
 * M3 (partie M) veut un code unique par niveau, et une série de vingt cellules sans code
 * serait refusée vingt fois. Le suffixe est numérique et part de 2 : la
 * première copie suit l'original, qui garde son code.
 *
 * Aucune règle de nommage n'est inventée ici — `naming_rule` appartient au
 * module 02 (L3) et n'existe pas encore. Ce suffixe est une commodité de
 * saisie, renommable, et l'écran le dit.
 */
export function seriesCodes(base: string, count: number): readonly string[] {
  const codes: string[] = [];
  for (let n = 2; n <= count + 1; n += 1) codes.push(`${base}-${String(n)}`);
  return codes;
}
