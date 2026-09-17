/**
 * Adaptateur sur le dépôt réel, lu par l'API REST de PostgreSQL.
 *
 * Aucune bibliothèque cliente : `fetch` et rien d'autre (A3.3). L'API REST
 * expose les tables telles qu'elles sont ; le cloisonnement par organisation
 * reste celui de la base, appliqué ligne à ligne, jamais reproduit ici — un
 * filtre côté écran ne serait pas un cloisonnement.
 *
 * Le schéma n'est pas `public` : chaque requête le nomme par l'en-tête
 * `Accept-Profile`, ce qui évite de dépendre du schéma par défaut du service.
 */
import { assembleSiteData } from '@azimut/db/mapping';
import type {
  BuildingRow, CategoryRow, DestinationNameRow, DestinationRow, EdgeRow,
  FootprintRow, LevelRow, NodeRow, OrganizationRow, PictogramRow,
  PlanCalibrationRow, PlanSourceRow, SiteRow,
  SupportContentBlockRow, SupportFaceRow, SupportRow, SupportTypologyRow,
  SupportVersionRow, TravelProfileRow, VerticalLinkRow, VolumeRow,
} from '@azimut/db/mapping';
import type { SiteData } from '@azimut/core-model';
import {
  RepositoryError, errorCodeForStatus,
  type SiteRepository, type SiteSummary,
} from './site-repository.js';

type SiteListRow = Pick<
  SiteRow,
  'id' | 'org_id' | 'name' | 'country_code' | 'rules_pack_id'
>;

export type PostgrestConfig = {
  /** Racine de l'API REST, sans barre oblique finale. */
  readonly url: string;
  /** Clé publiable. Elle n'ouvre rien par elle-même : le cloisonnement est en base. */
  readonly apiKey: string;
  /** Schéma interrogé. */
  readonly schema: string;
};

/** Une requête en échec qu'aucun statut n'explique : réseau coupé, ou service injoignable. */
function transportError(detail: string): RepositoryError {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return new RepositoryError(offline ? 'NET.OFFLINE' : 'NET.REQUEST_FAILED', detail);
}

async function query<Row>(
  config: PostgrestConfig,
  table: string,
  search: string,
): Promise<readonly Row[]> {
  const url = `${config.url}/${table}?${search}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        'Accept-Profile': config.schema,
        Accept: 'application/json',
      },
    });
  } catch (cause) {
    throw transportError(`${table}: ${String(cause)}`);
  }

  if (!response.ok) {
    throw new RepositoryError(
      errorCodeForStatus(response.status),
      `${table}: ${String(response.status)} ${response.statusText}`,
    );
  }

  try {
    return await response.json() as readonly Row[];
  } catch (cause) {
    throw new RepositoryError('NET.REQUEST_FAILED', `${table}: ${String(cause)}`);
  }
}

/** Filtre `in.(a,b,c)` de PostgREST. Une liste vide ne déclenche aucune requête. */
function inList(column: string, ids: readonly string[]): string {
  return `${column}=in.(${ids.join(',')})`;
}

async function queryIn<Row>(
  config: PostgrestConfig,
  table: string,
  column: string,
  ids: readonly string[],
): Promise<readonly Row[]> {
  if (ids.length === 0) return [];
  return query<Row>(config, table, inList(column, ids));
}

function firstOrThrow<Row>(rows: readonly Row[], table: string, id: string): Row {
  const row = rows[0];
  if (row === undefined) {
    throw new RepositoryError('NET.NOT_FOUND', `${table}:${id}`);
  }
  return row;
}

export function createPostgrestRepository(config: PostgrestConfig): SiteRepository {
  return {
    kind: 'postgrest',
    origin: `${config.url} · ${config.schema}`,

    async listSites(): Promise<readonly SiteSummary[]> {
      // La projection est plus étroite que `SiteRow` : la liste n'a besoin que
      // de quoi nommer un site. Le type dit exactement les colonnes demandées,
      // sinon il promettrait des champs que la réponse ne porte pas.
      const rows = await query<SiteListRow>(
        config,
        'site',
        'select=id,org_id,name,country_code,rules_pack_id&order=name.asc',
      );
      return rows.map((row): SiteSummary => ({
        id: row.id,
        org_id: row.org_id,
        name: row.name,
        country_code: row.country_code,
        rules_pack_id: row.rules_pack_id,
      }));
    },

    async loadSite(siteId: string): Promise<SiteData> {
      const siteRows = await query<SiteRow>(config, 'site', `id=eq.${siteId}`);
      const site = firstOrThrow(siteRows, 'site', siteId);

      const orgRows = await query<OrganizationRow>(
        config, 'organization', `id=eq.${site.org_id}`,
      );
      const organization = firstOrThrow(orgRows, 'organization', site.org_id);

      const buildings = await query<BuildingRow>(config, 'building', `site_id=eq.${siteId}`);
      const levels = await queryIn<LevelRow>(
        config, 'level', 'building_id', buildings.map(b => b.id),
      );
      const levelIds = levels.map(l => l.id);

      const [
        footprints, planSources, nodes, categories, pictograms, travelProfiles,
        supports, typologies,
      ] =
        await Promise.all([
          queryIn<FootprintRow>(config, 'footprint', 'level_id', levelIds),
          queryIn<PlanSourceRow>(config, 'plan_source', 'level_id', levelIds),
          queryIn<NodeRow>(config, 'node', 'level_id', levelIds),
          query<CategoryRow>(config, 'category', `org_id=eq.${site.org_id}`),
          query<PictogramRow>(config, 'pictogram', `org_id=eq.${site.org_id}`),
          query<TravelProfileRow>(config, 'travel_profile', `site_id=eq.${siteId}`),
          query<SupportRow>(config, 'support', `site_id=eq.${siteId}`),
          query<SupportTypologyRow>(config, 'support_typology', `org_id=eq.${site.org_id}`),
        ]);

      const footprintIds = footprints.map(f => f.id);
      const nodeIds = nodes.map(n => n.id);

      const [volumes, edges, destinations, planCalibrations] = await Promise.all([
        queryIn<VolumeRow>(config, 'volume', 'footprint_id', footprintIds),
        queryIn<EdgeRow>(config, 'edge', 'from_node_id', nodeIds),
        queryIn<DestinationRow>(config, 'destination', 'footprint_id', footprintIds),
        queryIn<PlanCalibrationRow>(
          config, 'plan_calibration', 'plan_source_id', planSources.map(p => p.id),
        ),
      ]);

      const supportIds = supports.map(s => s.id);

      const [verticalLinks, destinationNames, supportFaces, supportVersions] =
        await Promise.all([
          queryIn<VerticalLinkRow>(config, 'vertical_link', 'edge_id', edges.map(e => e.id)),
          queryIn<DestinationNameRow>(
            config, 'destination_name', 'destination_id', destinations.map(d => d.id),
          ),
          queryIn<SupportFaceRow>(config, 'support_face', 'support_id', supportIds),
          queryIn<SupportVersionRow>(config, 'support_version', 'support_id', supportIds),
        ]);

      const contentBlocks = await queryIn<SupportContentBlockRow>(
        config, 'support_content_block', 'face_id', supportFaces.map(f => f.id),
      );

      return assembleSiteData({
        organization,
        site,
        buildings,
        levels,
        plan_sources: planSources,
        plan_calibrations: planCalibrations,
        footprints,
        volumes,
        nodes,
        edges,
        vertical_links: verticalLinks,
        categories,
        pictograms,
        destinations,
        destination_names: destinationNames,
        travel_profiles: travelProfiles,
        supports,
        support_typologies: typologies,
        support_faces: supportFaces,
        content_blocks: contentBlocks,
        support_versions: supportVersions,
      });
    },
  };
}
