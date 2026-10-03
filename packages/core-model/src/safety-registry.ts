import type { PictogramRegistry } from './site.js';
import type { Finding, Outcome } from './outcome.js';

/**
 * INV-3 — le registre de sécurité est cloisonné.
 *
 * « Aucune charte client ne peut modifier une couleur, une géométrie, un
 * pictogramme ou une proportion relevant du registre de sécurité. Le moteur
 * refuse l'opération et lève une erreur. Il n'avertit pas, il ne dégrade pas,
 * il refuse. »
 *
 * **Pourquoi ces gardes ont changé de paquet.** Ils vivaient dans
 * `engine-graph`, et rien ne les appelait : le registre n'était donc protégé
 * que sur le chemin de la charte, par `guardCharterOnSafety`, et pas du tout
 * sur celui de la bibliothèque. Le point de passage de toute écriture est
 * `buildCommand`, en `site-commands.ts` — M12.A2, « l'atelier n'écrit jamais
 * directement en base, il appelle les commandes du module propriétaire ». Or
 * A4.1 interdit à `core-model` de lire un moteur. Les gardes descendent donc
 * là où l'écriture passe, et `engine-graph` les réexporte : les appelants
 * existants ne changent pas.
 *
 * **Ce qu'ils prennent, et pourquoi c'est plus étroit qu'avant.** Ils
 * recevaient un `SiteData` entier pour n'y lire que le registre d'un
 * pictogramme. Une commande ne porte pas de site : elle porte la ligne, avec
 * sa colonne `registry`. Les gardes prennent donc la seule chose qu'ils
 * lisaient, et `SiteData.pictograms` la satisfait sans conversion.
 */

/** Ce qu'un garde a besoin de savoir d'un pictogramme : son registre. */
export type PictogramRegistryEntry = {
  readonly id: string;
  readonly registry: PictogramRegistry;
};

export type PictogramMutation = {
  readonly pictogram_id: string;
  readonly field: string;
  readonly old_value: string;
  readonly new_value: string;
};

/** Un pictogramme proposé à la création. J5.1 : l'identifiant n'existe pas encore. */
export type PictogramCreation = {
  readonly id: string;
  readonly registry: PictogramRegistry;
};

function denial(id: string, params: Finding['params']): Finding {
  return {
    code: 'SECURITY.REGISTRY_WRITE_DENIED',
    severity: 'blocking',
    entity: { kind: 'pictogram', id },
    params,
    ruleRef: 'INV-3',
  };
}

function refuse(findings: readonly Finding[]): Outcome<null> {
  if (findings.length > 0) return { ok: false, findings: [...findings] };
  return { ok: true, value: null, warnings: [] };
}

/**
 * Refuse toute modification d'un pictogramme du registre de sécurité.
 *
 * Une modification portant sur un pictogramme inconnu est ignorée : ce garde
 * dit ce que le registre interdit, il ne dit pas ce qui existe. Une référence
 * introuvable est l'affaire des contrôles de `validateLibrary`.
 */
export function guardSafetyRegistry(
  pictograms: readonly PictogramRegistryEntry[],
  mutations: readonly PictogramMutation[],
): Outcome<null> {
  const known = new Map(pictograms.map(p => [p.id, p]));
  const findings: Finding[] = [];

  for (const mutation of [...mutations].sort(
    (l, r) => l.pictogram_id.localeCompare(r.pictogram_id),
  )) {
    if (known.get(mutation.pictogram_id)?.registry !== 'safety') continue;
    findings.push(denial(mutation.pictogram_id, {
      field: mutation.field,
      attempted_value: mutation.new_value,
    }));
  }

  return refuse(findings);
}

/**
 * Refuse la création d'un pictogramme **dans** le registre de sécurité.
 *
 * J5.1 : « Les pictogrammes proviennent du paquet de règles, versionnés et
 * référencés. Aucune création. » C'est la voie que les deux autres gardes ne
 * couvrent pas, un identifiant neuf ne correspondant à aucune ligne existante.
 */
export function guardSafetyCreation(
  creations: readonly PictogramCreation[],
): Outcome<null> {
  const findings = [...creations]
    .sort((l, r) => l.id.localeCompare(r.id))
    .filter(creation => creation.registry === 'safety')
    .map(creation => denial(creation.id, { operation: 'create' }));

  return refuse(findings);
}

/** Refuse la suppression d'un pictogramme du registre de sécurité. */
export function guardSafetyDeletion(
  pictograms: readonly PictogramRegistryEntry[],
  pictogramIds: readonly string[],
): Outcome<null> {
  const known = new Map(pictograms.map(p => [p.id, p]));
  const findings = [...pictogramIds]
    .sort()
    .filter(id => known.get(id)?.registry === 'safety')
    .map(id => denial(id, { operation: 'delete' }));

  return refuse(findings);
}
