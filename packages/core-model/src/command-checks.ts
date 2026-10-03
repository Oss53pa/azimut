/**
 * Les contrôles que `buildCommand` applique à une commande, table par table.
 *
 * Séparés de `site-commands.ts` pour la raison qu'A2.4 donne — un fichier ne
 * passe pas quatre cents lignes sans découpage — et parce que la coupure est
 * naturelle : ce module dit ce qui est refusé, `site-commands.ts` dit ce
 * qu'est une commande et comment on l'inverse.
 *
 * Il n'importe de `site-commands.ts` que des types. L'import est donc effacé à
 * la compilation, et le cycle apparent entre les deux fichiers n'existe pas à
 * l'exécution.
 */
import {
  guardSafetyRegistry, guardSafetyCreation, guardSafetyDeletion,
} from './safety-registry.js';
import type { PictogramRegistryEntry, PictogramMutation } from './safety-registry.js';
import { factValueFault } from './fact-keys.js';
import type { PictogramRegistry } from './site.js';
import type { Finding } from './outcome.js';
import { touchedColumns } from './row-values.js';
import type { RowValues } from './row-values.js';
import type { CommandDraft } from './site-commands.js';

/** Une anomalie de commande, au sens d'E5.1. */
function finding(
  code: string,
  params: Record<string, string | number>,
  id: string,
): Finding {
  return {
    code,
    severity: 'blocking',
    entity: { kind: 'command', id },
    params,
    ruleRef: 'E5.1',
  };
}

// ---------------------------------------------------------------------------
// Registre de sécurité (INV-3)
// ---------------------------------------------------------------------------

/** La table qu'INV-3 protège. Nommée, pour que le littéral ne se disperse pas. */
const SAFETY_GUARDED_TABLE = 'pictogram';
const FACT_TABLE = 'site_fact';
const FACT_KEY_COLUMN = 'key';
const FACT_VALUE_COLUMN = 'value';

/** La colonne qui dit de quel registre relève un pictogramme, section A5.4. */
const REGISTRY_COLUMN = 'registry';

/**
 * Ce qu'INV-3 refuse dans cette commande.
 *
 * **C'est ici que l'invariant 3 s'applique à la bibliothèque**, et c'est le
 * seul endroit qui le puisse : `buildCommand` est le passage obligé de toute
 * écriture, M12.A2, donc de toute voie de contournement présente ou à venir.
 * Le brancher sur un écran d'édition de pictogrammes protégerait cet écran ;
 * le brancher ici protège le modèle.
 *
 * Quatre refus :
 *
 *  · créer un pictogramme dans le registre de sécurité ;
 *  · modifier un pictogramme qui s'y trouve ;
 *  · **y faire entrer** un pictogramme d'orientation, en écrivant `safety`
 *    dans sa colonne de registre. C'est la voie la moins évidente, et celle
 *    qu'un garde lisant le seul état antérieur laisserait passer ;
 *  · supprimer un pictogramme qui s'y trouve.
 *
 * Et un cinquième, qui n'est pas une voie mais une absence : une commande sur
 * cette table dont les lignes ne déclarent pas le registre. On ne peut alors
 * pas savoir ce qu'elle touche, et A7 tranche — « un moteur qui reçoit une
 * entrée qu'il ne peut pas traiter refuse ». Laisser passer ferait du champ
 * omis la voie de contournement la plus simple de toutes.
 */
export function safetyRegistryFaults(
  draft: CommandDraft,
  before: RowValues | null,
  after: RowValues | null,
): readonly Finding[] {
  if (draft.table !== SAFETY_GUARDED_TABLE) return [];

  const declared = [before, after]
    .filter((row): row is RowValues => row !== null)
    .map(row => registryOf(row));

  if (declared.some(registry => registry === null)) {
    return [finding('SECURITY.REGISTRY_WRITE_DENIED', {
      operation: draft.operation,
      fault: 'registry_undeclared',
    }, draft.id)];
  }

  // Le registre effectif de la ligne : de sécurité si l'un des deux états le
  // dit. Retenir le seul état antérieur laisserait entrer un pictogramme dans
  // le registre ; retenir le seul état postérieur laisserait en sortir un.
  const entry: PictogramRegistryEntry = {
    id: draft.id,
    registry: declared.includes('safety') ? 'safety' : 'wayfinding',
  };

  const outcome = draft.operation === 'create'
    ? guardSafetyCreation([{ id: draft.id, registry: entry.registry }])
    : draft.operation === 'delete'
      ? guardSafetyDeletion([entry], [draft.id])
      : guardSafetyRegistry([entry], mutationsOf(draft.id, before, after));

  return outcome.ok ? [] : outcome.findings;
}

/**
 * A5.11 — « Une valeur qui ne correspond pas au type déclaré est refusée. »
 *
 * La table des clés donne à chacune le type attendu de sa valeur. Une écriture
 * de fait qui porte « oui » là où la table déclare un booléen est une commande
 * mal formée, au même titre qu'une création sans état postérieur : elle ne
 * peut pas être appliquée telle quelle. Elle est donc refusée par
 * `EDIT.COMMAND_SHAPE_INVALID`, et non par un code neuf — le catalogue de D2.2
 * est clos, et cette anomalie a déjà son code.
 *
 * Une clé que la table ne porte pas ne produit aucun défaut : voir
 * `fact-keys.ts`, qui dit pourquoi l'ensemble des clés n'est pas fermé.
 */
export function factKeyFaults(
  draft: CommandDraft,
  after: RowValues | null,
): readonly Finding[] {
  if (draft.table !== FACT_TABLE || after === null) return [];

  const key = after[FACT_KEY_COLUMN];
  const value = after[FACT_VALUE_COLUMN];
  if (typeof key !== 'string' || value === null || value === undefined) return [];

  const fault = factValueFault(key, value);
  if (fault === null) return [];

  return [finding('EDIT.COMMAND_SHAPE_INVALID', {
    operation: draft.operation,
    fault: 'fact_value_type',
    key: fault.key,
    expected: fault.expected,
    received: fault.received,
  }, draft.id)];
}

/** Le registre déclaré par une ligne, ou `null` si elle ne le déclare pas. */
function registryOf(row: RowValues): PictogramRegistry | null {
  const raw = row[REGISTRY_COLUMN];
  return raw === 'safety' || raw === 'wayfinding' ? raw : null;
}

/** Les colonnes qu'une modification change, sous la forme qu'attend le garde. */
function mutationsOf(
  id: string,
  before: RowValues | null,
  after: RowValues | null,
): readonly PictogramMutation[] {
  return touchedColumns(before, after).map(field => ({
    pictogram_id: id,
    field,
    old_value: String(before?.[field] ?? ''),
    new_value: String(after?.[field] ?? ''),
  }));
}
