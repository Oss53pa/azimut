/**
 * M1 (partie M) — création d'un site.
 *
 * Le formulaire de M1 (partie M) porte quatre champs et quatre contrôles. Cette fonction
 * les tient, et rend les commandes à écrire — elle n'écrit pas elle-même :
 * M12.A2 veut que l'interface passe par les commandes du module
 * propriétaire, et le module 01 possède `site`, `building` et `level` (L3).
 *
 * « Créer un site crée aussi un premier bâtiment et un premier niveau, nommés
 * par défaut et renommables. Un site sans niveau est un état inutile que
 * l'utilisateur devrait corriger lui-même. » Les trois commandes partent donc
 * ensemble, sous un même groupe : un seul geste, une seule annulation.
 */
import type { EntityCommand, Finding, Outcome } from '@azimut/core-model';
import { buildCommand } from '@azimut/core-model';

/** M1 (partie M) : « requis, 2 à 120 caractères ». */
export const SITE_NAME_MIN = 2;
export const SITE_NAME_MAX = 120;

export type SiteDraft = {
  readonly name: string;
  /** Code pays sur deux lettres, tel que M1 (partie M) l'affiche en colonne. */
  readonly countryCode: string;
  /**
   * O4 et A5.2 — identifiant de fuseau, requis à la création.
   *
   * « Tous les horaires, disponibilités d'arêtes, plages de fermeture et
   * échéances de contrats s'interprètent dans ce fuseau. » La colonne est
   * NOT NULL en base : sans lui, la création échouerait à l'écriture au lieu
   * d'être refusée à la saisie.
   */
  readonly timezone: string;
  /** M1 (partie M) : « facultatif à la création ». */
  readonly rulesPackId: string | null;
  /** M1 (partie M) : « au moins une, français et anglais proposés ». */
  readonly activeLangs: readonly string[];
};

/** Ce que l'appelant fournit et que le calcul ne peut pas inventer. */
export type CreationContext = {
  readonly orgId: string;
  /** Les identifiants, tirés par l'appelant : un calcul ne tire pas au sort. */
  readonly siteId: string;
  readonly buildingId: string;
  readonly levelId: string;
  /** Les noms des sites de l'organisation, pour l'unicité de M1 (partie M). */
  readonly existingNames: readonly string[];
  /** Noms par défaut du premier bâtiment et du premier niveau, traduits. */
  readonly defaultBuildingName: string;
  readonly defaultLevelName: string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

/**
 * Valide le formulaire et rend les trois commandes du geste.
 *
 * Les anomalies bloquantes sont rendues toutes ensemble : M7.5 (partie M) veut
 * qu'un refus n'efface jamais le travail en cours, et corriger un champ pour
 * découvrir le suivant ferait du formulaire un couloir.
 */
export function createSiteCommands(
  draft: SiteDraft,
  context: CreationContext,
): Outcome<readonly EntityCommand[]> {
  const findings = [
    ...checkName(draft.name, context.existingNames),
    ...checkCountry(draft.countryCode),
    ...checkTimezone(draft.timezone),
    ...checkLangs(draft.activeLangs),
  ];
  if (findings.length > 0) return { ok: false, findings };

  const commands: EntityCommand[] = [];
  for (const draftCommand of rowsOf(draft, context)) {
    const built = buildCommand(draftCommand);
    // `buildCommand` refuse une table que le module ne possède pas, une forme
    // incohérente, ou un horodatage absent. Les trois sont écartés ci-dessus
    // ou fixés ici ; un refus signalerait une régression, pas une saisie.
    if (!built.ok) return { ok: false, findings: built.findings };
    commands.push(built.value);
  }

  // M1 (partie M), version 6 : le paquet de règles est facultatif à la
  // création et n'y lève **aucune anomalie**. L'écran affiche à la place une
  // information : la composition restera bloquée tant qu'aucun paquet n'est
  // rattaché. `RULES.PACK_NOT_BOUND` garde sa gravité unique, bloquante, et se
  // lève à l'opération qui exige des règles, pas ici.
  return { ok: true, value: commands, warnings: [] };
}

function rowsOf(draft: SiteDraft, context: CreationContext) {
  const group = `create-site:${context.siteId}`;
  const common = {
    operation: 'create' as const,
    module: '01-socle' as const,
    org_id: context.orgId,
    timestamp: context.timestamp,
    groupKey: group,
  };
  return [
    {
      ...common,
      table: 'site',
      id: context.siteId,
      after: {
        id: context.siteId,
        org_id: context.orgId,
        name: draft.name.trim(),
        country_code: draft.countryCode,
        timezone: draft.timezone,
        rules_pack_id: draft.rulesPackId,
        active_langs: JSON.stringify([...draft.activeLangs].sort()),
      },
    },
    {
      ...common,
      table: 'building',
      id: context.buildingId,
      after: {
        id: context.buildingId,
        org_id: context.orgId,
        site_id: context.siteId,
        name: context.defaultBuildingName,
      },
    },
    {
      ...common,
      table: 'level',
      id: context.levelId,
      after: {
        id: context.levelId,
        org_id: context.orgId,
        building_id: context.buildingId,
        name: context.defaultLevelName,
        // Premier niveau : rang zéro, altitude de référence. Ce n'est pas une
        // valeur normative mais le point d'origine vertical du site, que M01.S1
        // fige ensuite avec le premier calage.
        ordinal: 0,
        elevation_m: 0,
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Les quatre contrôles de M1 (partie M)
// ---------------------------------------------------------------------------

function checkName(name: string, existing: readonly string[]): readonly Finding[] {
  const trimmed = name.trim();
  if (trimmed.length < SITE_NAME_MIN || trimmed.length > SITE_NAME_MAX) {
    return [finding('DATA.NAME_REQUIRED', {
      length: trimmed.length,
      min: SITE_NAME_MIN,
      max: SITE_NAME_MAX,
    })];
  }
  // L'unicité se juge sur le nom normalisé : deux sites qui ne diffèrent que
  // par une casse ou une espace de bord sont le même nom pour un lecteur.
  const key = normalise(trimmed);
  if (existing.some(other => normalise(other) === key)) {
    return [finding('DATA.NAME_DUPLICATE', { name: trimmed })];
  }
  return [];
}

function checkCountry(code: string): readonly Finding[] {
  return /^[A-Z]{2}$/.test(code)
    ? []
    : [finding('DATA.COUNTRY_REQUIRED', { given: code === '' ? 'none' : code })];
}

/**
 * O4 — le fuseau du site. Requis, et vérifié contre les fuseaux que la
 * plateforme connaît plutôt que contre une liste écrite ici : une liste de
 * fuseaux copiée à la main vieillit, et le produit n'a pas à tenir la base
 * de données des fuseaux du monde.
 */
function checkTimezone(timezone: string): readonly Finding[] {
  if (timezone.trim() !== '' && knownTimezones().includes(timezone)) return [];
  return [finding('DATA.TIMEZONE_REQUIRED', {
    given: timezone === '' ? 'none' : timezone,
  })];
}

function checkLangs(langs: readonly string[]): readonly Finding[] {
  return langs.length > 0
    ? []
    : [finding('DATA.LANG_REQUIRED', { count: 0 })];
}

/**
 * Les fuseaux que la plateforme d'exécution déclare.
 *
 * `Intl.supportedValuesOf` les rend depuis la base de données de fuseaux du
 * système, versionnée avec lui. C'est une donnée, pas une constante écrite
 * ici, et elle reste juste quand un pays change de règle.
 */
export function knownTimezones(): readonly string[] {
  const intl: unknown = Intl;
  if (typeof intl !== 'object' || intl === null) return [];
  const supported = (intl as { supportedValuesOf?: unknown }).supportedValuesOf;
  if (typeof supported !== 'function') return [];
  const values: unknown = (supported as (key: string) => unknown).call(Intl, 'timeZone');
  return Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string') : [];
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase('fr').normalize('NFC');
}

function finding(code: string, params: Record<string, string | number>): Finding {
  return { code, severity: 'blocking', entity: null, params, ruleRef: 'partieM-M1 (partie M)' };
}
