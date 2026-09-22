/**
 * F15 — `state/`, « magasin et commandes, écrit dans le dépôt ».
 *
 * C'est le seul endroit de l'interface qui mène à une écriture. M12.A2
 * le formule comme une interdiction : « L'atelier n'écrit jamais directement
 * en base. Il appelle les commandes du module propriétaire. C'est ce qui
 * empêche la règle de propriété unique d'être contournée par l'interface. »
 *
 * Le magasin ne connaît ni SQL, ni schéma, ni organisation. Il tient une pile
 * et confie les commandes à un émetteur qu'on lui donne — ce qui le rend
 * vérifiable sans base, et empêche l'interface de court-circuiter le chemin.
 */
import type { EntityCommand, Outcome, Finding } from '@azimut/core-model';
import { inverseCommand } from '@azimut/core-model';

/** E5.2 — profondeur de la pile d'annulation, constante nommée. */
export const UNDO_DEPTH = 200;

/**
 * Une entrée annulable : les commandes d'un même geste continu, regroupées
 * (E5.2). Un geste, une entrée, une annulation.
 */
export type UndoEntry = {
  readonly groupKey: string | null;
  readonly commands: readonly EntityCommand[];
};

export type StoreState = {
  readonly undoStack: readonly UndoEntry[];
  readonly redoStack: readonly UndoEntry[];
  /** Commandes appliquées localement et pas encore synchronisées (E5.3). */
  readonly pending: readonly EntityCommand[];
};

export const EMPTY_STORE: StoreState = {
  undoStack: [],
  redoStack: [],
  pending: [],
};

/**
 * Ce qui applique réellement les commandes. Le magasin n'en sait rien d'autre.
 * En production, `applyCommands` du paquet `db` ; aux essais, une doublure.
 */
export type CommandSink = (
  commands: readonly EntityCommand[],
) => Promise<Outcome<unknown>>;

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/**
 * Applique un geste, et ne l'empile que s'il a réellement écrit.
 *
 * Un refus ne laisse aucune trace dans la pile : M7.5 (partie M) veut qu'un refus de
 * saisie n'efface jamais le travail en cours, et une pile qui contiendrait une
 * commande jamais appliquée permettrait de l'« annuler », donc d'écrire son
 * inverse sur une ligne qui n'a pas bougé.
 */
export async function dispatch(
  state: StoreState,
  sink: CommandSink,
  commands: readonly EntityCommand[],
): Promise<{ state: StoreState; outcome: Outcome<unknown> }> {
  if (commands.length === 0) {
    return { state, outcome: { ok: true, value: null, warnings: [] } };
  }

  const outcome = await sink(commands);
  if (!outcome.ok) return { state, outcome };

  const entry: UndoEntry = {
    groupKey: commands[0]?.groupKey ?? null,
    commands,
  };
  return {
    state: {
      undoStack: capped([...state.undoStack, entry]),
      // Une écriture neuve rend le refaire caduc : la branche abandonnée ne
      // se recolle pas à la nouvelle.
      redoStack: [],
      pending: [...state.pending, ...commands],
    },
    outcome,
  };
}

function capped(entries: readonly UndoEntry[]): readonly UndoEntry[] {
  return entries.length <= UNDO_DEPTH
    ? entries
    : entries.slice(entries.length - UNDO_DEPTH);
}

// ---------------------------------------------------------------------------
// Annulation et rétablissement
// ---------------------------------------------------------------------------

/**
 * Annule le dernier geste, en écrivant son inverse.
 *
 * L'annulation n'est pas un retrait : c'est une écriture, qui passe par le
 * même chemin et le même cloisonnement. L'horodatage est fourni par
 * l'appelant, une commande ne lisant pas l'horloge (E5.1).
 *
 * Les commandes d'un geste sont inversées en ordre inverse : défaire la
 * dernière d'abord est la seule façon de retrouver l'état de départ quand
 * elles portent sur des lignes liées.
 */
export async function undo(
  state: StoreState,
  sink: CommandSink,
  timestamp: string,
): Promise<{ state: StoreState; outcome: Outcome<unknown> }> {
  const entry = state.undoStack[state.undoStack.length - 1];
  if (entry === undefined) {
    return { state, outcome: { ok: false, findings: [nothingToUndo()] } };
  }

  const inverses = [...entry.commands]
    .reverse()
    .map(c => inverseCommand(c, timestamp));

  const outcome = await sink(inverses);
  if (!outcome.ok) return { state, outcome };

  return {
    state: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
      pending: [...state.pending, ...inverses],
    },
    outcome,
  };
}

/** Rétablit le dernier geste annulé, en réécrivant ses commandes. */
export async function redo(
  state: StoreState,
  sink: CommandSink,
  timestamp: string,
): Promise<{ state: StoreState; outcome: Outcome<unknown> }> {
  const entry = state.redoStack[state.redoStack.length - 1];
  if (entry === undefined) {
    return { state, outcome: { ok: false, findings: [nothingToRedo()] } };
  }

  const replayed = entry.commands.map(c => ({ ...c, timestamp }));
  const outcome = await sink(replayed);
  if (!outcome.ok) return { state, outcome };

  return {
    state: {
      undoStack: capped([...state.undoStack, { ...entry, commands: replayed }]),
      redoStack: state.redoStack.slice(0, -1),
      pending: [...state.pending, ...replayed],
    },
    outcome,
  };
}

export function canUndo(state: StoreState): boolean {
  return state.undoStack.length > 0;
}

export function canRedo(state: StoreState): boolean {
  return state.redoStack.length > 0;
}

// ---------------------------------------------------------------------------
// E5.3 — la synchronisation vide la pile
// ---------------------------------------------------------------------------

/**
 * « La pile d'annulation est vidée à la synchronisation. Ce qui est
 * synchronisé n'est plus annulable localement. Revenir sur une modification
 * déjà synchronisée se fait par une nouvelle commande inverse, tracée, et non
 * par une annulation. »
 *
 * C'est ce qui rend tenable la rencontre d'un historique local et d'une fusion
 * par objet : sans cela, on pourrait annuler localement une opération déjà
 * fusionnée avec la version distante, et E5.3 dit que ce cas est ingérable.
 */
export function afterSync(state: StoreState): StoreState {
  void state;
  return EMPTY_STORE;
}

function nothingToUndo(): Finding {
  return {
    code: 'EDIT.NOTHING_TO_UNDO',
    severity: 'info',
    entity: null,
    params: {},
    ruleRef: 'E5.2',
  };
}

function nothingToRedo(): Finding {
  return {
    code: 'EDIT.NOTHING_TO_REDO',
    severity: 'info',
    entity: null,
    params: {},
    ruleRef: 'E5.2',
  };
}
