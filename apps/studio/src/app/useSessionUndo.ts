/**
 * E5.2 et S6.8 — annuler et rétablir pendant l'édition simultanée.
 *
 * Décision Q3 d'Oss53pa : la pile est conservée quand d'autres postes
 * écrivent ; l'annulation émet la commande inverse par le même émetteur
 * journalisé que tout geste, et les autres postes la reçoivent comme les
 * autres. Si l'objet a changé ailleurs, la base refuse en 409 (0078), le site
 * est relu, et le conflit est présenté avec ses deux versions
 * (`locateConflict`, moteur S6.3).
 *
 * Le geste en conflit reste au sommet de la pile : rien ne s'efface sans que
 * l'utilisateur le demande. Il peut l'écarter (`discard`), ce qui rend les
 * gestes plus anciens à l'annulation, ou fermer la présentation.
 *
 * Tiré de `useTrancheSession` pour la tenir sous 400 lignes (A2.4).
 */
import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  undo as undoLast, redo as redoLast, discardTop,
} from '../state/command-store.js';
import type { CommandSink, StoreState, UndoEntry, UndoOutcome } from '../state/command-store.js';
import { isStaleRefusal, locateConflict } from '../state/undo-conflict.js';
import type { UndoConflict, UndoSide } from '../state/undo-conflict.js';
import type { SessionState } from '../state/session-store.js';

export type SessionUndo = {
  readonly undo: () => Promise<boolean>;
  readonly redo: () => Promise<boolean>;
  /** S6.8 — le dernier conflit d'annulation, `null` s'il n'y en a pas. */
  readonly conflict: UndoConflict | null;
  /** Ferme la présentation ; le geste reste dans la pile. */
  readonly dismiss: () => void;
  /** Écarte le geste en conflit de sa pile, sans rien écrire. */
  readonly discard: () => void;
};

export function useSessionUndo(options: {
  readonly store: MutableRefObject<StoreState>;
  readonly setStore: (next: StoreState) => void;
  readonly sink: CommandSink;
  readonly current: MutableRefObject<SessionState>;
  readonly reload: () => Promise<void>;
  /** Le conflit présenté remplace le refus générique du dernier geste. */
  readonly clearRefusal: () => void;
}): SessionUndo {
  const { store, setStore, sink, current, reload, clearRefusal } = options;
  const [conflict, setConflict] = useState<UndoConflict | null>(null);
  // Le geste en conflit, par référence : un geste écrit depuis a pu prendre
  // le sommet, et l'écarter serait écarter le mauvais.
  const inConflict = useRef<UndoEntry | null>(null);

  const settle = useCallback(async (side: UndoSide, result: UndoOutcome): Promise<boolean> => {
    store.current = result.state;
    setStore(result.state);
    if (result.applied && result.outcome.ok) {
      setConflict(null);
      return true;
    }
    if (!result.outcome.ok && isStaleRefusal(result.outcome.findings)) {
      // Le site est relu avant d'être comparé : c'est sur l'état d'ailleurs
      // que le conflit se situe, pas sur celui que ce poste croyait voir.
      await reload();
      const stack = side === 'undo' ? result.state.undoStack : result.state.redoStack;
      inConflict.current = stack[stack.length - 1] ?? null;
      setConflict(locateConflict(current.current, side, result.attempted));
      clearRefusal();
    }
    // `applied` et non le seul verdict du puits : une pile vide n'est pas un
    // refus mais un geste qui n'a pas eu lieu.
    return false;
  }, [store, setStore, reload, current, clearRefusal]);

  const undo = useCallback(async (): Promise<boolean> =>
    settle('undo', await undoLast(store.current, sink, new Date().toISOString())), [settle, store, sink]);

  const redo = useCallback(async (): Promise<boolean> =>
    settle('redo', await redoLast(store.current, sink, new Date().toISOString())), [settle, store, sink]);

  const dismiss = useCallback((): void => { setConflict(null); }, []);

  const discard = useCallback((): void => {
    if (conflict === null) return;
    const stack = conflict.side === 'undo' ? store.current.undoStack : store.current.redoStack;
    if (inConflict.current !== null && stack[stack.length - 1] === inConflict.current) {
      store.current = discardTop(store.current, conflict.side);
      setStore(store.current);
    }
    inConflict.current = null;
    setConflict(null);
  }, [conflict, store, setStore]);

  return { undo, redo, conflict, dismiss, discard };
}
