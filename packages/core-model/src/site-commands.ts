/**
 * E5.1 — le vocabulaire d'écriture du module 01.
 *
 * « Toute modification de donnée passe par une commande, objet sérialisable
 * comportant : un type, une cible, les valeurs avant et après, et un
 * horodatage fourni par l'appelant, jamais lu par la commande elle-même. Une
 * commande est réversible. »
 *
 * Ces commandes sont celles du module propriétaire, au sens de M12.A2 :
 * « L'atelier n'écrit jamais directement en base. Il appelle les commandes du
 * module propriétaire. C'est ce qui empêche la règle de propriété unique
 * d'être contournée par l'interface. »
 *
 * Le fichier est pur : ni horloge, ni base, ni réseau. Construire une commande
 * ne l'applique pas.
 */
import type { ModuleKey } from './module-ownership.js';
import {
  OWNED_TABLES, SPLIT_OWNERSHIP_TABLE, ownsSupportColumn,
} from './module-ownership.js';
import {
  guardSafetyRegistry, guardSafetyCreation, guardSafetyDeletion,
} from './safety-registry.js';
import type { PictogramRegistryEntry, PictogramMutation } from './safety-registry.js';
import type { PictogramRegistry } from './site.js';
import type { Outcome, Finding } from './outcome.js';

// ---------------------------------------------------------------------------
// Forme d'une commande
// ---------------------------------------------------------------------------

/** Les trois opérations élémentaires. Rien d'autre n'écrit. */
export const COMMAND_OPERATIONS = ['create', 'update', 'delete'] as const;
export type CommandOperation = (typeof COMMAND_OPERATIONS)[number];

/** Une valeur de colonne telle qu'elle voyage dans une commande. */
export type ColumnValue = string | number | boolean | null;

/**
 * Rend une liste sous la forme qu'attend une colonne de tableau.
 *
 * Une commande ne transporte que des valeurs simples, et les deux chemins
 * d'écriture — la fonction `apply_commands` pour le poste, `applyCommands`
 * pour le service — aplatissent tout en texte avant d'atteindre la base. Une
 * liste doit donc voyager dans l'encodage de sa colonne, comme une structure
 * voyage déjà en JSON pour une colonne `jsonb`.
 *
 * Le défaut que cette fonction ferme : `site.active_langs` est une colonne de
 * tableau, et la création d'un site y écrivait du JSON. La base refusait
 * chaque création — « malformed array literal » — et rien ne le voyait, faute
 * d'essai qui applique les commandes du formulaire contre une base réelle.
 *
 * Les éléments sont rendus dans l'ordre reçu. Le tri, quand il compte, est la
 * décision de l'appelant et non de l'encodage.
 */
export function listValue(values: readonly string[]): string {
  return `{${values.map(quoteElement).join(',')}}`;
}

/**
 * Un élément se cite dès qu'il pourrait être relu autrement : séparateur,
 * accolade, guillemet, contre-oblique, espace de bord, chaîne vide, ou le mot
 * `NULL` que la base lirait comme une absence.
 */
function quoteElement(value: string): string {
  const plain = /^[^{}",\\\s]+$/.test(value) && value.toUpperCase() !== 'NULL';
  if (plain) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Les colonnes d'une ligne, par nom. */
export type RowValues = Readonly<Record<string, ColumnValue>>;

/**
 * Une commande d'écriture sur une entité du modèle.
 *
 * `before` est null à la création, `after` est null à la suppression : c'est ce
 * qui rend l'inverse calculable sans relire la base.
 */
export type EntityCommand = {
  readonly operation: CommandOperation;
  /** Le module qui émet la commande. Contrôlé contre la propriété (INT-1). */
  readonly module: ModuleKey;
  /** La table visée, telle que le schéma la nomme. */
  readonly table: string;
  /** L'identifiant de la ligne. Fourni par l'appelant, jamais tiré ici. */
  readonly id: string;
  /** L'organisation propriétaire de la ligne (A6.1). */
  readonly org_id: string;
  readonly before: RowValues | null;
  readonly after: RowValues | null;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
  /** Regroupement d'un geste continu en une seule entrée annulable (E5.2). */
  readonly groupKey: string | null;
};

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export type CommandDraft = {
  readonly operation: CommandOperation;
  readonly module: ModuleKey;
  readonly table: string;
  readonly id: string;
  readonly org_id: string;
  readonly before?: RowValues | null;
  readonly after?: RowValues | null;
  readonly timestamp: string;
  readonly groupKey?: string | null;
};

/**
 * Construit une commande, ou refuse.
 *
 * Trois refus, et chacun protège une règle :
 *  · une table — ou, pour `support`, une colonne — que le module émetteur ne
 *    possède pas (INT-1 et INT-2, et la scission de L0) ;
 *  · une forme incohérente avec l'opération, qui rendrait l'inverse incalculable ;
 *  · un horodatage absent, que la commande ne peut pas suppléer sans lire
 *    l'horloge.
 */
export function buildCommand(draft: CommandDraft): Outcome<EntityCommand> {
  const findings: Finding[] = [];
  const before = draft.before ?? null;
  const after = draft.after ?? null;

  for (const fault of ownershipFaults(draft)) {
    findings.push(finding('EDIT.TABLE_NOT_OWNED', fault, draft.id));
  }

  const shapeFault = shapeOf(draft.operation, before, after);
  if (shapeFault !== null) {
    findings.push(finding('EDIT.COMMAND_SHAPE_INVALID', {
      operation: draft.operation,
      fault: shapeFault,
    }, draft.id));
  }

  if (draft.timestamp.trim() === '') {
    findings.push(finding('EDIT.TIMESTAMP_REQUIRED', {
      operation: draft.operation,
    }, draft.id));
  }

  findings.push(...safetyRegistryFaults(draft, before, after));

  if (findings.length > 0) return { ok: false, findings };

  return {
    ok: true,
    value: {
      operation: draft.operation,
      module: draft.module,
      table: draft.table,
      id: draft.id,
      org_id: draft.org_id,
      before,
      after,
      timestamp: draft.timestamp,
      groupKey: draft.groupKey ?? null,
    },
    warnings: [],
  };
}

/** INT-1 et INT-2 : un module n'écrit que ce qu'il possède. */
export function ownsTable(module: ModuleKey, table: string): boolean {
  return OWNED_TABLES[module].includes(table);
}

// ---------------------------------------------------------------------------
// Registre de sécurité (INV-3)
// ---------------------------------------------------------------------------

/** La table qu'INV-3 protège. Nommée, pour que le littéral ne se disperse pas. */
const SAFETY_GUARDED_TABLE = 'pictogram';

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
function safetyRegistryFaults(
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

/**
 * Ce que la propriété unique refuse dans cette commande.
 *
 * Le cas courant est la table entière : un module qui ne la possède pas n'y
 * écrit rien. `support` fait exception — L0 lui donne deux propriétaires,
 * colonne par colonne, et c'est ce qui supprime le cycle entre les modules 02
 * et 04. Le contrôle y porte donc sur les colonnes que la commande changerait,
 * et non sur le nom de la table.
 *
 * Supprimer une ligne de `support` n'est le fait d'aucun des deux : la
 * suppression ne porte pas sur une colonne, et aucun des deux propriétaires
 * n'a autorité sur la part de l'autre. L'opération est refusée.
 */
function ownershipFaults(
  draft: CommandDraft,
): readonly Readonly<Record<string, string>>[] {
  const base = { module: draft.module, table: draft.table };

  if (draft.table !== SPLIT_OWNERSHIP_TABLE) {
    return ownsTable(draft.module, draft.table) ? [] : [base];
  }
  if (draft.operation === 'delete') {
    return [{ ...base, column: '*' }];
  }
  return touchedColumns(draft.before ?? null, draft.after ?? null)
    .filter(column => !ownsSupportColumn(draft.module, column))
    .map(column => ({ ...base, column }));
}

/**
 * Les colonnes qu'une commande change réellement.
 *
 * À la création comme à la suppression, tout ce qui est nommé est changé. À la
 * modification, seules les valeurs qui diffèrent : reposer une colonne à sa
 * propre valeur n'est pas une écriture, et l'exiger du propriétaire voisin
 * ferait échouer des commandes qui ne touchent à rien.
 */
function touchedColumns(
  before: RowValues | null,
  after: RowValues | null,
): readonly string[] {
  if (before === null || after === null) {
    return [...new Set([
      ...Object.keys(before ?? {}), ...Object.keys(after ?? {}),
    ])].sort();
  }
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].filter(n => before[n] !== after[n]).sort();
}

function shapeOf(
  operation: CommandOperation,
  before: RowValues | null,
  after: RowValues | null,
): string | null {
  if (operation === 'create') {
    if (before !== null) return 'before_must_be_null';
    if (after === null) return 'after_required';
    return null;
  }
  if (operation === 'delete') {
    if (after !== null) return 'after_must_be_null';
    if (before === null) return 'before_required';
    return null;
  }
  if (before === null) return 'before_required';
  if (after === null) return 'after_required';
  return null;
}

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
// Réversibilité (E5.1)
// ---------------------------------------------------------------------------

/**
 * L'inverse d'une commande.
 *
 * « Une commande est réversible. Une commande non réversible est refusée en
 * revue. » L'inverse se calcule sans relire la base, puisque la commande porte
 * ses deux états. L'horodatage de l'inverse est fourni par l'appelant : une
 * commande ne lit pas l'horloge, pas même pour se retourner.
 *
 * L'inverse d'un inverse est la commande d'origine, au groupe près.
 */
export function inverseCommand(
  command: EntityCommand,
  timestamp: string,
): EntityCommand {
  const operation: CommandOperation =
    command.operation === 'create' ? 'delete'
      : command.operation === 'delete' ? 'create'
        : 'update';

  return {
    operation,
    module: command.module,
    table: command.table,
    id: command.id,
    org_id: command.org_id,
    before: command.after,
    after: command.before,
    timestamp,
    groupKey: command.groupKey,
  };
}

/**
 * Les colonnes qu'une mise à jour change réellement.
 *
 * Sert au tableau des messages (M02.W8) autant qu'à l'écriture : « Toute
 * modification du graphe ou de l'annuaire marque périmées les seules lignes
 * concernées. Ni plus, ni moins. » Une commande qui ne change rien se voit.
 */
export function changedColumns(command: EntityCommand): readonly string[] {
  return touchedColumns(command.before, command.after);
}
