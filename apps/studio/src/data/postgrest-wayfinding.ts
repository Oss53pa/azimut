/**
 * N2.2 — lecture du registre du wayfinding par l'API REST : zones
 * d'orientation, règles de nommage, niveaux d'information (migration 0027).
 *
 * Les énumérés sont restreints par les listes de `core-model`, qu'un test
 * structurel tient égales aux CHECK de la base. Une valeur hors liste ne peut
 * donc venir que d'un schéma qui a dérivé : la lecture échoue alors, plutôt
 * que d'écarter la ligne en silence.
 */
import {
  isOrientationZoneKind, isNamingTarget, isNamingScope, isInformationLevelRank,
  type WayfindingRegistry, type OrientationZone, type NamingRule, type InformationLevelBinding,
} from '@azimut/core-model';
import { RepositoryError } from './site-repository.js';
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';

type SiteOrgRow = { readonly id: string; readonly org_id: string };

type ZoneRow = {
  readonly id: string;
  readonly code: string;
  readonly name_fr: string;
  readonly name_en: string;
  readonly kind: string;
  readonly footprint_ids: unknown;
};

type NamingRuleRow = {
  readonly id: string;
  readonly target: string;
  readonly pattern: string;
  readonly max_length: number;
  readonly uniqueness_scope: string;
};

type TypologyRow = { readonly id: string; readonly key: string };
type InformationLevelRow = { readonly typology_id: string; readonly level: number };

function drift(table: string, detail: string): RepositoryError {
  return new RepositoryError('request_failed', `${table}: ${detail}`);
}

function stringArray(value: unknown, table: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === 'string')) {
    throw drift(table, 'footprint_ids n’est pas une liste d’identifiants');
  }
  return value;
}

export async function loadWayfindingRegistry(
  config: PostgrestConfig,
  siteId: string,
): Promise<WayfindingRegistry> {
  // Le site d'abord, comme pour le vocabulaire : un site masqué par le
  // cloisonnement doit se lire « inaccessible », pas « ne déclare rien ».
  const sites = await query<SiteOrgRow>(config, 'site', `select=id,org_id&id=eq.${siteId}`);
  const site = sites[0];
  if (site === undefined) throw new RepositoryError('not_found', `site: ${siteId}`);

  const [zoneRows, ruleRows, typologyRows] = await Promise.all([
    query<ZoneRow>(
      config, 'orientation_zone',
      `select=id,code,name_fr,name_en,kind,footprint_ids&site_id=eq.${siteId}&order=code.asc`,
    ),
    query<NamingRuleRow>(
      config, 'naming_rule',
      `select=id,target,pattern,max_length,uniqueness_scope&site_id=eq.${siteId}&order=target.asc,id.asc`,
    ),
    // Les typologies appartiennent à l'organisation, pas au site.
    query<TypologyRow>(config, 'support_typology', `select=id,key&org_id=eq.${site.org_id}`),
  ]);

  const levelRows = await queryIn<InformationLevelRow>(
    config, 'information_level', 'typology_id', typologyRows.map(t => t.id),
  );

  const zones = zoneRows.map((row): OrientationZone => {
    if (!isOrientationZoneKind(row.kind)) throw drift('orientation_zone', `kind « ${row.kind} »`);
    return {
      id: row.id,
      code: row.code,
      name_fr: row.name_fr,
      name_en: row.name_en,
      kind: row.kind,
      footprint_ids: stringArray(row.footprint_ids, 'orientation_zone'),
    };
  });

  const naming_rules = ruleRows.map((row): NamingRule => {
    if (!isNamingTarget(row.target)) throw drift('naming_rule', `target « ${row.target} »`);
    if (!isNamingScope(row.uniqueness_scope)) {
      throw drift('naming_rule', `uniqueness_scope « ${row.uniqueness_scope} »`);
    }
    return {
      id: row.id,
      target: row.target,
      pattern: row.pattern,
      max_length: row.max_length,
      uniqueness_scope: row.uniqueness_scope,
    };
  });

  const keyOf = new Map(typologyRows.map(t => [t.id, t.key]));
  const information_levels = levelRows
    .map((row): InformationLevelBinding => {
      const key = keyOf.get(row.typology_id);
      if (key === undefined) throw drift('information_level', `typologie ${row.typology_id} inconnue`);
      if (!isInformationLevelRank(row.level)) throw drift('information_level', `niveau ${String(row.level)}`);
      return { typology_key: key, level: row.level };
    })
    .sort((a, b) => a.typology_key.localeCompare(b.typology_key) || a.level - b.level);

  return { zones, naming_rules, information_levels };
}
