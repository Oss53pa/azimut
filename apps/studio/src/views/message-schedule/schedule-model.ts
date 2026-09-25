/**
 * H2.5 — état calculé de l'écran « Tableau des messages ».
 *
 * Toute la résolution de contenu revient au moteur : cet module ne fait que
 * lui fournir ses entrées et rassembler ses sorties. Aucun texte de face n'est
 * reconstruit ici (invariant 2).
 */
import type { SiteData, TravelProfile, Finding, InformationLevelBinding } from '@azimut/core-model';
import {
  generateMessageSchedule,
  checkMessageSchedule,
  computeScheduleInputsHash,
  guardWayfindingContinuity,
  guardNamingCollisions,
  NO_WAYFINDING_RULES,
  type MessageSchedule,
  type PlacedSupport,
  type TypologyInformationLevels,
  type WayfindingRules,
} from '@azimut/engine-graph';
import { trialPlacement, placedSupports } from '../../domain/trial-placement.js';
import { jalonnementFromSchedule, orientationNames } from '../../domain/wayfinding-checks.js';

/**
 * Horodatage de génération. Fourni par l'appelant, jamais lu dans un moteur
 * (E5.1) ; fixe tant que l'écran n'enregistre pas de version, pour que deux
 * affichages du même état de données soient identiques (invariant 4).
 */
export const SCHEDULE_GENERATED_AT = '1970-01-01T00:00:00.000Z';

export type ScheduleSource = 'placed' | 'trial';

export type ScheduleModel = {
  readonly schedule: MessageSchedule | null;
  /** Anomalies de génération, puis de contrôle, dans cet ordre. */
  readonly findings: readonly Finding[];
  readonly continuity: readonly Finding[];
  readonly naming: readonly Finding[];
  readonly supports: readonly PlacedSupport[];
  readonly source: ScheduleSource;
  readonly inputsHash: string;
  readonly staleCount: number;
};

function findingsOf(outcome: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): readonly Finding[] {
  if (outcome.ok) return outcome.warnings ?? [];
  return outcome.findings ?? [];
}

export type ScheduleInputsChoice = {
  readonly supportTypeKey: string;
  readonly version: number;
  readonly rules: WayfindingRules;
  readonly informationLevels: readonly TypologyInformationLevels[];
  readonly lang: string;
};

/**
 * Calcule le tableau et ses contrôles.
 *
 * Quand le site ne porte aucun support implanté, l'implantation d'essai prend
 * le relais — et l'écran le signale : `source` vaut alors `trial`.
 */
export function buildScheduleModel(
  site: SiteData,
  profile: TravelProfile,
  choice: ScheduleInputsChoice,
): ScheduleModel {
  const placed = placedSupports(site, choice.supportTypeKey);
  const trial = placed.length > 0 ? null : trialPlacement(site, profile, choice.supportTypeKey);
  const supports = placed.length > 0 ? placed : (trial?.supports ?? []);
  const source: ScheduleSource = placed.length > 0 ? 'placed' : 'trial';

  const inputs = {
    site,
    supports,
    profile,
    informationLevels: choice.informationLevels,
    rules: choice.rules,
  };
  const inputsHash = computeScheduleInputsHash(inputs);

  const generated = generateMessageSchedule({
    ...inputs,
    version: choice.version,
    generated_at: SCHEDULE_GENERATED_AT,
  });

  if (!generated.ok) {
    return {
      schedule: null,
      findings: generated.findings,
      continuity: [],
      naming: findingsOf(guardNamingCollisions(orientationNames(site, choice.lang))),
      supports,
      source,
      inputsHash,
      staleCount: 0,
    };
  }

  const schedule = generated.value;
  const checks = checkMessageSchedule(schedule, choice.rules);
  const sequences = jalonnementFromSchedule(site, schedule);

  return {
    schedule,
    findings: [...generated.warnings, ...checks],
    continuity: sequences.length === 0 ? [] : findingsOf(guardWayfindingContinuity(sequences)),
    naming: findingsOf(guardNamingCollisions(orientationNames(site, choice.lang))),
    supports,
    source,
    inputsHash,
    staleCount: schedule.lines.filter(l => l.stale).length,
  };
}

/**
 * Niveaux d'information déclarés pour chaque typologie du site (H2.3), lus
 * dans le registre du wayfinding (`information_level`, migration 0027).
 *
 * Une typologie sans déclaration n'a pas de niveau : elle n'en reçoit pas un
 * par défaut.
 */
export function declaredInformationLevels(
  site: SiteData,
  bindings: readonly InformationLevelBinding[] = [],
): readonly TypologyInformationLevels[] {
  return [...site.support_types]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((type): TypologyInformationLevels => ({
      support_type_key: type.key,
      levels: bindings
        .filter(b => b.typology_key === type.key)
        .map(b => b.level)
        .sort((a, b) => a - b),
    }));
}

export { NO_WAYFINDING_RULES };
