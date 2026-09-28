/**
 * O11 — déclarer ou retirer une fermeture temporaire.
 *
 * Une fermeture est une ligne de `temporary_closure` : une ou plusieurs
 * arêtes, un début, une fin, un motif. Commandes du module 01, propriétaire
 * de la table (Q2). Les contrôles de saisie n'ont pas de code au catalogue :
 * ce sont des refus de formulaire (D2.2, décision du 28/09/2026).
 *
 * Le recouvrement de deux fermetures sur une même arête (`CLOSURE.OVERLAP`,
 * avertissement, O11) n'est pas contrôlé ici : le code est au catalogue du
 * consolidé mais déclaré non construit, avec le reste d'O11 (incrément 3).
 *
 * Le fichier est pur : l'identifiant et l'horodatage viennent de l'appelant.
 */
import type { SiteData } from './site.js';
import { isLocalInstant, type TemporaryClosure } from './temporary-closure.js';
import { buildCommand, type EntityCommand, type RowValues } from './site-commands.js';
import { asFormOutcome, notice, refusedBy, type FormNotice, type FormOutcome } from './form-notice.js';

export type ClosureDraft = {
  readonly edgeIds: readonly string[];
  /** Début, heure locale du site `AAAA-MM-JJTHH:MM:SS`, inclus. */
  readonly from: string;
  /** Fin, même format, incluse. */
  readonly to: string;
  readonly reason: string;
};

export type ClosureEnvironment = {
  /** Tire l'identifiant. Injecté : une commande ne tire pas au sort. */
  readonly newId: () => string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

const MODULE = '01-socle';

/** Les refus du formulaire, tous ensemble (M7.5, partie M). */
export function validateClosureDraft(site: SiteData, draft: ClosureDraft): readonly FormNotice[] {
  const notices: FormNotice[] = [];
  const known = new Set(site.graph.edges.map(e => e.id));
  if (draft.edgeIds.length === 0) {
    notices.push(notice('form.closure.edges.required'));
  } else {
    const unknown = draft.edgeIds.filter(id => !known.has(id));
    if (unknown.length > 0) notices.push(notice('form.closure.edge.unknown', 'blocking', { edge_id: unknown.join(', ') }));
  }
  if (!isLocalInstant(draft.from) || !isLocalInstant(draft.to) || draft.to < draft.from) {
    notices.push(notice('form.closure.range.invalid', 'blocking', { from: draft.from, to: draft.to }));
  }
  if (draft.reason.trim() === '') notices.push(notice('form.closure.reason.required'));
  return notices;
}

/** Déclare une fermeture : une commande, ou les refus. */
export function declareClosureCommand(
  site: SiteData,
  draft: ClosureDraft,
  env: ClosureEnvironment,
): FormOutcome<EntityCommand> {
  const notices = validateClosureDraft(site, draft);
  if (notices.length > 0) return refusedBy(notices);
  const id = env.newId();
  // Les arêtes dans l'ordre de saisie, sans doublon : la ligne dit ce qu'on a choisi.
  const edgeIds = [...new Set(draft.edgeIds)];
  return asFormOutcome(buildCommand({
    operation: 'create', module: MODULE, table: 'temporary_closure', id, org_id: site.site.org_id,
    after: {
      id, org_id: site.site.org_id, site_id: site.site.id,
      edge_ids: JSON.stringify(edgeIds), from_at: draft.from, to_at: draft.to, reason: draft.reason.trim(),
    },
    timestamp: env.timestamp, groupKey: null,
  }));
}

/** Retire une fermeture ; l'inverse la recrée à l'identique. */
export function withdrawClosureCommand(closure: TemporaryClosure, timestamp: string): FormOutcome<EntityCommand> {
  const before: RowValues = {
    id: closure.id, org_id: closure.org_id, site_id: closure.site_id,
    edge_ids: JSON.stringify(closure.edge_ids), from_at: closure.from_at, to_at: closure.to_at, reason: closure.reason,
  };
  return asFormOutcome(buildCommand({
    operation: 'delete', module: MODULE, table: 'temporary_closure', id: closure.id, org_id: closure.org_id,
    before, timestamp, groupKey: null,
  }));
}
