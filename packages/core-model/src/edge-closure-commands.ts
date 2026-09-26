/**
 * A5.3 — déclarer ou retirer une fermeture d'arête.
 *
 * Une fermeture n'a pas de table : elle vit dans `edge.availability`. La
 * déclarer, c'est donc réécrire cette colonne par une commande `update` du
 * module 01, propriétaire du graphe (L3). La commande porte la valeur avant et
 * la valeur après, sérialisées : l'inverse se calcule sans relire la base
 * (E5.1).
 *
 * Une disponibilité illisible ne se réécrit pas d'ici : sa valeur avant n'est
 * pas connue du poste, et la remplacer effacerait en silence ce qu'elle
 * contient.
 *
 * Le fichier est pur : ni horloge, ni base, ni réseau.
 */
import type { Edge } from './site.js';
import { isClosureReason, isLocalInstant, type EdgeClosure } from './edge-availability.js';
import { buildCommand, type EntityCommand } from './site-commands.js';
import type { Finding, Outcome } from './outcome.js';

/** Ce que le formulaire soumet. */
export type ClosureDraft = {
  readonly from: string;
  readonly to: string;
  readonly reason_key: string;
};

export type ClosureEnvironment = {
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
  /** `membership.id` du déclarant, ou `null` faute de session. */
  readonly declaredBy: string | null;
};

const RULE_REF = 'A5.3';

function refusal(code: string, edgeId: string, params: Record<string, string> = {}): Finding {
  return { code, severity: 'blocking', entity: { kind: 'edge', id: edgeId }, params, ruleRef: RULE_REF };
}

function sameClosure(a: EdgeClosure, b: EdgeClosure): boolean {
  return a.from === b.from && a.to === b.to && a.reason_key === b.reason_key;
}

function ordered(closures: readonly EdgeClosure[]): readonly EdgeClosure[] {
  return [...closures].sort((a, b) =>
    a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.reason_key.localeCompare(b.reason_key));
}

/**
 * La colonne telle qu'elle s'écrit : clés dans un ordre fixe, fermetures
 * triées. Deux déclarations identiques s'écrivent à l'identique (INV-4).
 * Aucune fermeture : la colonne redevient vide.
 */
export function serializeEdgeAvailability(closures: readonly EdgeClosure[]): string | null {
  if (closures.length === 0) return null;
  return JSON.stringify({
    closures: ordered(closures).map(c => ({
      from: c.from, to: c.to, reason_key: c.reason_key, declared_by: c.declared_by,
    })),
  });
}

/** Les fermetures actuelles, ou le refus d'une disponibilité illisible. */
function currentClosures(edge: Edge): Outcome<readonly EdgeClosure[]> {
  const availability = edge.availability;
  if (availability === undefined) return { ok: true, value: [], warnings: [] };
  if (!availability.readable) {
    return { ok: false, findings: [refusal('GRAPH.CLOSURE_AVAILABILITY_UNREADABLE', edge.id)] };
  }
  return { ok: true, value: availability.closures, warnings: [] };
}

function rewrite(
  edge: Edge,
  before: readonly EdgeClosure[],
  after: readonly EdgeClosure[],
  timestamp: string,
): Outcome<EntityCommand> {
  return buildCommand({
    operation: 'update',
    module: '01-socle',
    table: 'edge',
    id: edge.id,
    org_id: edge.org_id,
    before: { availability: serializeEdgeAvailability(before) },
    after: { availability: serializeEdgeAvailability(after) },
    timestamp,
    groupKey: null,
  });
}

/** Ce que le formulaire refuse, avant toute commande. */
export function validateClosureDraft(edge: Edge, draft: ClosureDraft): readonly Finding[] {
  const findings: Finding[] = [];
  if (!isLocalInstant(draft.from) || !isLocalInstant(draft.to)) {
    findings.push(refusal('GRAPH.CLOSURE_RANGE_INVALID', edge.id, { from: draft.from, to: draft.to }));
  } else if (draft.to < draft.from) {
    findings.push(refusal('GRAPH.CLOSURE_RANGE_INVALID', edge.id, { from: draft.from, to: draft.to }));
  }
  if (!isClosureReason(draft.reason_key)) {
    findings.push(refusal('GRAPH.CLOSURE_REASON_UNKNOWN', edge.id, { reason_key: draft.reason_key }));
  }
  return findings;
}

/** Déclare une fermeture sur l'arête : une commande, ou les refus. */
export function declareClosureCommand(
  edge: Edge,
  draft: ClosureDraft,
  env: ClosureEnvironment,
): Outcome<EntityCommand> {
  const current = currentClosures(edge);
  if (!current.ok) return current;
  const findings = validateClosureDraft(edge, draft);
  if (findings.length > 0) return { ok: false, findings: [...findings] };

  const closure: EdgeClosure = {
    from: draft.from, to: draft.to, reason_key: draft.reason_key, declared_by: env.declaredBy,
  };
  if (current.value.some(c => sameClosure(c, closure))) {
    return { ok: false, findings: [refusal('GRAPH.CLOSURE_DUPLICATE', edge.id, { from: draft.from, to: draft.to })] };
  }
  return rewrite(edge, current.value, [...current.value, closure], env.timestamp);
}

/** Retire une fermeture déclarée : une commande, ou le refus. */
export function withdrawClosureCommand(
  edge: Edge,
  closure: EdgeClosure,
  timestamp: string,
): Outcome<EntityCommand> {
  const current = currentClosures(edge);
  if (!current.ok) return current;
  const index = current.value.findIndex(c => sameClosure(c, closure));
  if (index < 0) {
    return { ok: false, findings: [refusal('GRAPH.CLOSURE_NOT_FOUND', edge.id, { from: closure.from, to: closure.to })] };
  }
  return rewrite(edge, current.value, current.value.filter((_, i) => i !== index), timestamp);
}
