/**
 * T-1.13 et D4.1 — la reprise d'un carnet de supports existant, du rapport du
 * moteur aux commandes de ligne.
 *
 * `importSupports` lit le fichier : colonnes, types, doublons dans le fichier,
 * nœud inconnu. Ce module confronte ensuite chaque ligne au site, puis traduit
 * les lignes prêtes en commandes. Décisions d'Oss53pa du 27 novembre 2026
 * (`docs/decoupage-reprise-carnet.md`) :
 *
 *  - QI1 : une ligne sans nœud, position seule, reste en attente ; rien n'est
 *    écrit, et rien n'est inventé ;
 *  - QI2 : le contenu constaté et le substrat restent au rapport ;
 *  - QI3, corrigée le même jour : l'état et la date de pose vont dans
 *    `installed_support`, version vide, « posé avant Azimut, version
 *    inconnue » ; la base refuse 0 (0047, `installed_version >= 1`) ;
 *  - QI5 : le module 02 crée la ligne `support` ; les cotes viennent par une
 *    commande du module 04, dans le même geste.
 *
 * Dans le même esprit que QI1 : un azimut absent laisse la ligne en attente.
 * La base donnerait 0, une orientation que personne n'a relevée. Une date de
 * pose absente n'écrit pas de ligne `installed_support` : la base y mettrait
 * l'instant de l'import.
 *
 * Le registre du support n'est pas écrit : la typologie ne le porte pas encore
 * (`support_typology.registry`, colonne spécifiée et absente du schéma).
 *
 * Pur : les identifiants sont tirés par l'appelant (Q10), l'horodatage fourni.
 */
import { buildCommand } from '@azimut/core-model';
import type { EntityCommand, Finding, Outcome, SiteData } from '@azimut/core-model';
import type { ImportedSupport, ImportReport } from '@azimut/engine-graph';

export type CarnetStatus = 'ready' | 'pending' | 'rejected';

export type CarnetLine = {
  readonly row: number;
  readonly reference: string;
  readonly status: CarnetStatus;
  readonly support: ImportedSupport | null;
  readonly findings: readonly Finding[];
};

const finding = (code: string, params: Record<string, string | number>): Finding =>
  ({ code, severity: 'warning', entity: null, params, ruleRef: 'D4.1' });

const rejected = (row: number, support: ImportedSupport, reason: string): CarnetLine =>
  ({ row, reference: support.reference, status: 'rejected', support, findings: [finding('IMPORT.ROW_INVALID', { row, reason })] });

const pending = (row: number, support: ImportedSupport, params: Record<string, string | number>): CarnetLine =>
  ({ row, reference: support.reference, status: 'pending', support, findings: [finding('IMPORT.NODE_NOT_FOUND', { row, reference: support.reference, ...params })] });

/** Chaque ligne du fichier, confrontée au site, dans l'ordre du fichier. */
export function resolveCarnet(report: ImportReport, site: SiteData): readonly CarnetLine[] {
  const existingCodes = new Set(site.supports.map(s => s.code).filter((c): c is string => c !== undefined));
  return report.lines.map((line): CarnetLine => {
    const support = line.support;
    if (support === null || line.status !== 'imported') {
      return {
        row: line.row, reference: support?.reference ?? '', support,
        status: line.status === 'pending' ? 'pending' : 'rejected', findings: line.findings,
      };
    }
    const row = line.row;
    // La typologie appartient à l'organisation, et la base n'en rend pas la
    // clé unique : une clé portée deux fois ne désigne rien.
    const typologies = site.support_types.filter(t => t.key === support.typology);
    if (typologies.length === 0) return rejected(row, support, 'typology_unknown');
    if (typologies.length > 1) return rejected(row, support, 'typology_ambiguous');
    const building = site.buildings.find(b => b.name === support.building);
    if (building === undefined) return rejected(row, support, 'building_unknown');
    const level = site.levels.find(l => l.building_id === building.id && l.name === support.level);
    if (level === undefined) return rejected(row, support, 'level_unknown');
    if (existingCodes.has(support.reference)) {
      return {
        row, reference: support.reference, status: 'rejected', support,
        findings: [finding('IMPORT.DUPLICATE_KEY', { row, key: support.reference, existing: 'site' })],
      };
    }
    if (support.node_ref === null) {
      return pending(row, support, { node_ref: '', reason: 'node_missing' });
    }
    const node = site.graph.nodes.find(n => n.id === support.node_ref);
    if (node === undefined) return pending(row, support, { node_ref: support.node_ref, reason: 'node_unknown' });
    if (node.level_id !== level.id) return rejected(row, support, 'node_level_mismatch');
    if (support.azimuth_deg === null) return pending(row, support, { node_ref: support.node_ref, reason: 'azimuth_missing' });
    return { row, reference: support.reference, status: 'ready', support, findings: [] };
  });
}

export type CarnetWrite = {
  readonly orgId: string;
  readonly siteId: string;
  readonly timestamp: string;
  readonly groupKey: string;
  /** Un identifiant neuf par ligne créée (Q10). */
  readonly newId: () => string;
};

/** Les commandes des lignes prêtes ; les autres n'écrivent rien. */
export function carnetCommands(
  lines: readonly CarnetLine[], site: SiteData, write: CarnetWrite,
): Outcome<readonly EntityCommand[]> {
  const commands: EntityCommand[] = [];
  const common = { org_id: write.orgId, timestamp: write.timestamp, groupKey: write.groupKey };
  for (const line of lines) {
    const s = line.support;
    if (line.status !== 'ready' || s === null || s.node_ref === null || s.azimuth_deg === null) continue;
    const typologies = site.support_types.filter(t => t.key === s.typology);
    const typology = typologies[0];
    if (typology === undefined || typologies.length > 1) continue;
    const id = write.newId();
    const drafts = [
      buildCommand({
        ...common, operation: 'create', module: '02-wayfinding', table: 'support', id,
        after: {
          id, org_id: write.orgId, site_id: write.siteId, code: s.reference, node_id: s.node_ref,
          typology_id: typology.id, azimuth_deg: String(s.azimuth_deg),
          ...(s.reading_distance_m === null ? {} : { reading_distance_m: String(s.reading_distance_m) }),
        },
      }),
      ...(s.dimensions_source === 'overridden' ? [buildCommand({
        ...common, operation: 'update', module: '04-signaletique', table: 'support', id,
        before: { width_mm: null, height_mm: null, dimensions_source: null },
        after: { width_mm: s.width_mm, height_mm: s.height_mm, dimensions_source: 'overridden' },
      })] : []),
      ...(s.installed_at === null ? [] : [(() => {
        const installedId = write.newId();
        return buildCommand({
          ...common, operation: 'create', module: '08-exploitation', table: 'installed_support', id: installedId,
          after: {
            id: installedId, org_id: write.orgId, support_id: id,
            installed_at: s.installed_at, condition: s.condition,
          },
        });
      })()]),
    ];
    for (const built of drafts) {
      if (!built.ok) return { ok: false, findings: built.findings };
      commands.push(built.value);
    }
  }
  return { ok: true, value: commands, warnings: [] };
}
