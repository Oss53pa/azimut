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
  ParkingRow, ParkingSpaceRow, ParkingUncoveredAreaRow, VehicleGateRow,
} from '@azimut/db/mapping';
import type {
  SiteData, SiteVocabulary, LexiconTerm, LexiconSeverity,
  SiteFact, SourceClaim, DiscrepancyDecision,
} from '@azimut/core-model';
import {
  RepositoryError,
  type SiteRepository, type SiteSummary,
  type CountrySummary, type LegalEntitySummary,
} from './site-repository.js';
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';
import { loadWayfindingRegistry } from './postgrest-wayfinding.js';
import { loadCharterRegistry } from './postgrest-charter.js';
import { loadMaintenanceRegistry } from './postgrest-maintenance.js';
import { loadWorksiteRegistry } from './postgrest-worksite.js';
import { loadBudgetRegistry } from './postgrest-budget.js';
import { loadInspectionRegistry } from './postgrest-inspection.js';

type SiteListRow = Pick<
  SiteRow,
  'id' | 'org_id' | 'name' | 'country_code' | 'rules_pack_id'
>;

export type { PostgrestConfig } from './postgrest-http.js';

/**
 * Lignes des registres de vocabulaire. Elles ne passent pas par `@azimut/db` :
 * ce sont des lectures simples, sans assemblage, et les décrire ici évite une
 * table de transposition qui n'aurait qu'un seul appelant.
 */
type CharterRow = { readonly id: string };

type CountryRow = {
  readonly code: string;
  readonly name_fr: string;
  readonly name_en: string;
  readonly timezones: readonly string[];
};

type LegalEntityRow = { readonly id: string; readonly legal_name: string };

type LexiconTermRow = {
  readonly lang: string;
  readonly term: string;
  readonly severity: string;
};

type SiteFactRow = {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly source: string;
  readonly recorded_on: string;
};

type ForbiddenWordRow = {
  readonly site_fact_id: string;
  readonly lang: string;
  readonly term: string;
};

type SourceClaimRow = {
  readonly key: string;
  readonly source: string;
  readonly value: string;
  readonly recorded_on: string;
};

type DecisionRow = {
  readonly key: string;
  readonly decided_source: string;
  readonly decided_by: string;
  readonly decided_on: string;
};

/**
 * Une sévérité inconnue vaut « interdit ».
 *
 * C'est le sens le plus strict, et c'est délibéré : une valeur que le code ne
 * comprend pas ne doit pas se traduire par un contrôle plus indulgent. Mieux
 * vaut un signalement de trop, qu'un relecteur écarte, qu'un terme interdit qui
 * passe parce que sa sévérité était mal orthographiée en base.
 */
function toSeverity(raw: string): LexiconSeverity {
  return raw === 'discouraged' ? 'discouraged' : 'forbidden';
}

function firstOrThrow<Row>(rows: readonly Row[], table: string, id: string): Row {
  const row = rows[0];
  if (row === undefined) {
    throw new RepositoryError('not_found', `${table}:${id}`);
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

      // Complément atelier M2 — stationnement. Les portails et les parkings
      // pendent aux niveaux, les places et les zones non couvertes aux
      // parkings : deux vagues, comme pour les faces et leurs blocs.
      const [contentBlocks, parkings, vehicleGates] = await Promise.all([
        queryIn<SupportContentBlockRow>(
          config, 'support_content_block', 'face_id', supportFaces.map(f => f.id),
        ),
        queryIn<ParkingRow>(config, 'parking', 'level_id', levelIds),
        queryIn<VehicleGateRow>(config, 'vehicle_gate', 'level_id', levelIds),
      ]);

      const parkingIds = parkings.map(p => p.id);
      const [parkingSpaces, parkingUncovered] = await Promise.all([
        queryIn<ParkingSpaceRow>(config, 'parking_space', 'parking_id', parkingIds),
        queryIn<ParkingUncoveredAreaRow>(
          config, 'parking_uncovered_area', 'parking_id', parkingIds,
        ),
      ]);

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
        parkings,
        parking_spaces: parkingSpaces,
        parking_uncovered: parkingUncovered,
        vehicle_gates: vehicleGates,
      });
    },

    async loadVocabulary(siteId: string): Promise<SiteVocabulary> {
      // Le site est vérifié d'abord. Sans cela, un identifiant inconnu — ou un
      // site que le cloisonnement par ligne masque — rendrait quatre listes
      // vides, et l'écran lirait « ce site ne déclare rien » au lieu de
      // « ce site ne vous est pas accessible ». L'adaptateur de référence
      // refuse déjà dans ce cas ; les deux doivent se comporter pareil.
      const siteRows = await query<SiteRow>(config, 'site', `select=id&id=eq.${siteId}`);
      if (siteRows.length === 0) {
        throw new RepositoryError('not_found', `site: ${siteId}`);
      }

      const [charters, factRows, claimRows, decisionRows] = await Promise.all([
        // Le lexique pend à la charte, elle-même au site. On passe par les
        // identifiants de charte plutôt que par un filtre sur ressource
        // imbriquée : la forme imbriquée de PostgREST exige que la ressource
        // soit aussi dans le `select`, et la dépendre d'une syntaxe de jointure
        // non éprouvée ferait échouer la requête entière. Le filtre par clé
        // étrangère est déjà le mode employé partout ailleurs dans ce fichier.
        query<CharterRow>(config, 'charter', `select=id&site_id=eq.${siteId}`),
        query<SiteFactRow>(
          config, 'site_fact', `select=id,key,value,source,recorded_on&site_id=eq.${siteId}`,
        ),
        query<SourceClaimRow>(
          config, 'source_claim', `select=key,source,value,recorded_on&site_id=eq.${siteId}`,
        ),
        query<DecisionRow>(
          config,
          'discrepancy_decision',
          `select=key,decided_source,decided_by,decided_on&site_id=eq.${siteId}`,
        ),
      ]);

      const [lexiconRows, wordRows] = await Promise.all([
        queryIn<LexiconTermRow>(
          config, 'lexicon_term', 'charter_id', charters.map(c => c.id),
        ),
        queryIn<ForbiddenWordRow>(
          config, 'site_fact_forbidden_word', 'site_fact_id', factRows.map(f => f.id),
        ),
      ]);

      const wordsByFact = new Map<string, { lang: string; term: string }[]>();
      for (const row of wordRows) {
        const bucket = wordsByFact.get(row.site_fact_id);
        const word = { lang: row.lang, term: row.term };
        if (bucket === undefined) wordsByFact.set(row.site_fact_id, [word]);
        else bucket.push(word);
      }

      const lexicon: LexiconTerm[] = lexiconRows.map(row => ({
        lang: row.lang,
        term: row.term,
        severity: toSeverity(row.severity),
      }));

      const facts: SiteFact[] = factRows.map(row => ({
        key: row.key,
        value: row.value,
        source: row.source,
        recorded_on: row.recorded_on,
        forbidden: wordsByFact.get(row.id) ?? [],
      }));

      const claims: SourceClaim[] = claimRows.map(row => ({
        key: row.key,
        source: row.source,
        value: row.value,
        recorded_on: row.recorded_on,
      }));

      const decisions: Record<string, DiscrepancyDecision> = {};
      for (const row of decisionRows) {
        decisions[row.key] = {
          source: row.decided_source,
          decided_by: row.decided_by,
          decided_on: row.decided_on,
        };
      }

      return { lexicon, facts, claims, decisions };
    },

    loadWayfindingRegistry(siteId: string) {
      return loadWayfindingRegistry(config, siteId);
    },

    loadCharterRegistry(siteId: string) {
      return loadCharterRegistry(config, siteId);
    },

    loadMaintenanceRegistry(siteId: string) {
      return loadMaintenanceRegistry(config, siteId);
    },

    loadWorksiteRegistry(siteId: string) {
      return loadWorksiteRegistry(config, siteId);
    },

    loadBudgetRegistry(siteId: string) {
      return loadBudgetRegistry(config, siteId);
    },

    loadInspectionRegistry(siteId: string) {
      return loadInspectionRegistry(config, siteId);
    },

    /**
     * Q9 — lecture du référentiel global. Il n'est pas cloisonné : la table
     * n'a pas d'`org_id` et sa politique la rend lisible par tout compte
     * authentifié.
     */
    async listCountries(): Promise<readonly CountrySummary[]> {
      const rows = await query<CountryRow>(
        config, 'country', 'select=code,name_fr,name_en,timezones&order=code.asc',
      );
      return rows.map((row): CountrySummary => ({
        code: row.code,
        name_fr: row.name_fr,
        name_en: row.name_en,
        timezones: row.timezones,
      }));
    },

    /**
     * Q5 — les entités juridiques visibles. Le cloisonnement est celui de la
     * base : la requête ne filtre pas par organisation, la politique le fait.
     */
    async listLegalEntities(): Promise<readonly LegalEntitySummary[]> {
      const rows = await query<LegalEntityRow>(
        config, 'legal_entity', 'select=id,legal_name&order=legal_name.asc',
      );
      return rows.map((row): LegalEntitySummary => ({
        id: row.id, legal_name: row.legal_name,
      }));
    },
  };
}
