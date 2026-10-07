/**
 * R12 (partie R) — ce que l'émission pour revue exige, lu dans la session.
 *
 * « Aucune anomalie bloquante, et validation de complétude du graphe passée,
 * règle M02.W11. » R14 y ajoute le paquet de règles rattaché. Chaque condition
 * se lit ici dans ce que la session porte, et aucune n'est supposée remplie :
 *
 *  · les anomalies du tableau sont celles de R14 qui bloquent l'émission :
 *    support sans niveau d'information (`checkMessageSchedule`), continuité
 *    rompue (H2.4) et collision de nommage (H2.2), dans chaque langue active ;
 *  · la validation est passée si le dernier passage enregistré pour le site
 *    est réussi et porte l'empreinte du graphe actuel (M02.W11, A5.3) : un
 *    graphe modifié depuis la périme sans qu'on ait rien à effacer ;
 *  · le paquet est rattaché si le site a une ligne de rattachement (A5.8).
 *
 * Le plafond de destinations par face n'est pas recontrôlé ici : R14 en fait
 * un déclencheur de l'écartement, appliqué à la génération et tracé ligne par
 * ligne (M02.W9), non un blocage de l'émission.
 */
import type { Finding, Outcome } from '@azimut/core-model';
import { codePointCompare } from '@azimut/core-model';
import {
  NO_WAYFINDING_RULES, checkMessageSchedule, computeGraphHash,
  guardNamingCollisions, guardWayfindingContinuity,
} from '@azimut/engine-graph';
import type { MessageSchedule } from '@azimut/engine-graph';
import { jalonnementFromSchedule, orientationNames } from '../domain/wayfinding-checks.js';
import type { WayfindingCheckSite } from '../domain/wayfinding-checks.js';
import type { SessionState } from './session-store.js';
import { rowsOf } from './session-store.js';
import { graphScopeFromSession } from './session-scope.js';
import { boolean, text } from './row-values.js';
import type { TransitionConditions } from './message-schedule-transitions.js';

function findingsOf(outcome: Outcome<null>): readonly Finding[] {
  return outcome.ok ? outcome.warnings : outcome.findings;
}

/** M02.W11 — le dernier passage du site est-il réussi, et pour ce graphe-ci ? */
function graphValidatedIn(session: SessionState, siteId: string, graphHash: string | null): boolean {
  if (graphHash === null) return false;
  // L'instant, et non le texte : un passage relu de la base porte `+00:00`
  // là où un passage écrit dans la session porte `Z`.
  const instant = (row: { readonly values: Readonly<Record<string, unknown>> }): number => {
    const at = Date.parse(text(row.values, 'ran_at') ?? '');
    return Number.isNaN(at) ? -Infinity : at;
  };
  const runs = rowsOf(session, 'graph_validation')
    .filter(row => text(row.values, 'site_id') === siteId)
    .sort((a, b) => instant(b) - instant(a) || codePointCompare(b.id, a.id));
  const last = runs[0];
  if (last === undefined) return false;
  return boolean(last.values, 'passed') && text(last.values, 'graph_hash') === graphHash;
}

/** Le paquet de règles du site : la table de rattachement fait foi (A5.8). */
export function rulesPackBoundIn(session: SessionState, siteId: string): boolean {
  return rowsOf(session, 'site_rules_binding').some(row => row.values['site_id'] === siteId);
}

/** Le seul prérequis de M02.W11, pour le bandeau de l'écran. */
export function graphValidatedForSite(session: SessionState, siteId: string): boolean {
  const hash = computeGraphHash(graphScopeFromSession(session).scope.graph);
  return graphValidatedIn(session, siteId, hash.ok ? hash.value : null);
}

/** Les anomalies de R14 qui bloquent l'émission, pour ce tableau. */
function submissionFindings(
  session: SessionState, schedule: MessageSchedule, langs: readonly string[],
): readonly Finding[] {
  // La portée de la validation porte l'annuaire de la session : les
  // garde-fous de nommage et de continuité lisent la même lecture que M5.
  const { scope } = graphScopeFromSession(session);
  const site: WayfindingCheckSite = scope;
  const sequences = jalonnementFromSchedule(site, schedule);
  return [
    ...checkMessageSchedule(schedule, NO_WAYFINDING_RULES),
    ...(sequences.length === 0 ? [] : findingsOf(guardWayfindingContinuity(sequences))),
    ...langs.flatMap(lang => findingsOf(guardNamingCollisions(orientationNames(site, lang)))),
  ];
}

/** Les conditions de R12 pour ce tableau, toutes lues dans la session. */
export function submissionConditions(
  session: SessionState,
  siteId: string,
  schedule: MessageSchedule,
  openAnnotationIds: readonly string[],
  langs: readonly string[],
): TransitionConditions {
  return {
    findings: submissionFindings(session, schedule, langs),
    graphValidated: graphValidatedForSite(session, siteId),
    rulesPackBound: rulesPackBoundIn(session, siteId),
    openAnnotationIds,
    rejectionReason: null,
  };
}
