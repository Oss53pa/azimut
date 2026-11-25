/**
 * S6.1c — l'éditeur d'habillage écrit dans le dépôt, et s'y relit.
 *
 * Il tenait son document en mémoire : rien ne survivait au rechargement, et
 * rien ne se propageait. Ce magasin garde l'interface de `useEditorDocument`
 * et change ce qui se passe dessous :
 *
 *  - à l'ouverture, et à chaque relecture du site par la coquille (une
 *    commande reçue d'un autre poste en provoque une, S6.6c), le document est
 *    relu au dépôt (`loadDecorationRecords`, `decorationFromRows`) ;
 *  - un geste est traduit en commandes de ligne (`decorationCommands`) et
 *    confié à l'émetteur de la coquille, journalisé quand une session est
 *    ouverte. Il n'entre au document et à la pile que s'il a été écrit
 *    (M7.5, partie M) ; puis le document est relu, la base faisant foi ;
 *  - annuler écrit l'inverse du geste, par le même chemin (décision Q3) : la
 *    pile est conservée quand d'autres postes écrivent ; si l'objet a changé
 *    ailleurs, la base refuse en 409, rien ne bouge, le geste reste dans la
 *    pile, et le refus est rendu.
 *
 * Sans dépôt configuré, le document reste en mémoire, comme avant : l'éditeur
 * demeure praticable sur un poste nu.
 *
 * Les gestes partent l'un après l'autre : un second geste ne se traduit
 * qu'une fois le premier écrit, sur le document qu'il a laissé.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Finding, SiteData } from '@azimut/core-model';
import { SiteSinkContext } from '../context/site-writer.js';
import { loadDecorationRecords } from '../data/postgrest-decoration.js';
import type { Command, HistoryAction, HistoryState } from '../editor/command.js';
import { EMPTY_HISTORY, canRedo, canUndo, historyReducer } from '../editor/command.js';
import { decorationCommands } from '../editor/decoration-commands.js';
import { decorationFromRows } from '../editor/decoration-rows.js';
import type { DocumentAction, DocumentPatch, EditorDocument } from '../editor/editor-document.js';
import { documentReducer, emptyDocument, isDocumentPatch } from '../editor/editor-document.js';
import type { EditorDocumentApi } from '../editor/use-editor-document.js';
import { appSink, appSinkConfig } from './app-sink.js';

export type DecorationStore = EditorDocumentApi & {
  /** Le refus du dernier geste, vide après un geste écrit. */
  readonly refusal: readonly Finding[];
  /** Lignes du dépôt que l'éditeur n'a pas su lire, et qu'il n'affiche pas. */
  readonly unreadable: number;
  /** Le document n'a pas pu être relu au dépôt. */
  readonly loadFailed: boolean;
};

const isStale = (f: Finding): boolean => f.params['cause'] === '409';

export function useDecorationStore(site: SiteData): DecorationStore {
  const siteId = site.site.id;
  const orgId = site.organization.id;
  const provided = useContext(SiteSinkContext);
  const own = useMemo(() => (provided === undefined ? appSink() : null), [provided]);
  const sink = provided === undefined ? own : provided;
  const config = useMemo(() => (sink === null ? null : appSinkConfig()), [sink]);

  // Le document et la pile vivent dans des références tenues à jour sur le
  // champ : un geste mis en file part de l'état que le précédent a laissé,
  // sans attendre un rendu.
  const [document, setDocument] = useState<EditorDocument>(() => emptyDocument(siteId));
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const currentHistory = useRef<HistoryState>(EMPTY_HISTORY);
  const dispatchHistory = useCallback((action: HistoryAction): void => {
    currentHistory.current = historyReducer(currentHistory.current, action);
    setHistory(currentHistory.current);
  }, []);
  const [refusal, setRefusal] = useState<readonly Finding[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const current = useRef<EditorDocument>(document);
  const dispatchDocument = useCallback((action: DocumentAction): void => {
    current.current = documentReducer(current.current, action);
    setDocument(current.current);
  }, []);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);

  const reload = useCallback(async (): Promise<void> => {
    if (config === null) return;
    try {
      const records = await loadDecorationRecords(config, siteId);
      const read = decorationFromRows(records.layers, records.shapes);
      setLoadFailed(false);
      setUnreadable(read.unreadable);
      // Un geste en cours d'écriture sera suivi de sa propre relecture.
      if (pending.current > 0) return;
      dispatchDocument({ type: 'reset', document: { siteId, layers: read.layers, shapes: read.shapes } });
    } catch {
      setLoadFailed(true);
    }
  }, [config, siteId, dispatchDocument]);

  // La coquille relit le site quand d'autres postes écrivent : l'habillage
  // se relit avec lui.
  useEffect(() => { void reload(); }, [reload, site]);

  /** Écrit un geste ; vrai s'il est écrit, ou s'il n'y a pas de dépôt. */
  const write = useCallback(async (command: Command<DocumentPatch>): Promise<boolean> => {
    const translated = decorationCommands(command, current.current.shapes, {
      orgId, timestamp: command.timestamp, groupKey: command.groupKey,
    });
    if (!translated.ok) { setRefusal(translated.findings); return false; }
    if (sink === null || translated.value.length === 0) { setRefusal([]); return true; }
    pending.current += 1;
    const out = await sink(translated.value);
    pending.current -= 1;
    if (!out.ok) {
      setRefusal(out.findings);
      if (out.findings.some(isStale)) void reload();
      return false;
    }
    setRefusal([]);
    return true;
  }, [orgId, sink, reload]);

  const serial = useCallback((run: () => Promise<void>): void => {
    queue.current = queue.current.then(run, run);
  }, []);

  const execute = useCallback((command: Command<DocumentPatch>): void => {
    serial(async () => {
      if (!(await write(command))) return;
      dispatchDocument({ type: 'apply', patch: command.after });
      dispatchHistory({ type: 'execute', command });
      void reload();
    });
  }, [serial, write, reload, dispatchDocument, dispatchHistory]);

  const undo = useCallback((): void => {
    serial(async () => {
      const stack = currentHistory.current.undoStack;
      const entry = stack[stack.length - 1];
      if (entry === undefined || !isDocumentPatch(entry.before) || !isDocumentPatch(entry.after)) return;
      const { before, after } = entry;
      const inverse: Command<DocumentPatch> = { ...entry, before: after, after: before, timestamp: new Date().toISOString() };
      if (!(await write(inverse))) return;
      dispatchDocument({ type: 'apply', patch: before });
      dispatchHistory({ type: 'undo' });
      void reload();
    });
  }, [serial, write, reload, dispatchDocument, dispatchHistory]);

  const redo = useCallback((): void => {
    serial(async () => {
      const stack = currentHistory.current.redoStack;
      const entry = stack[stack.length - 1];
      if (entry === undefined || !isDocumentPatch(entry.before) || !isDocumentPatch(entry.after)) return;
      const { before, after } = entry;
      const replay: Command<DocumentPatch> = { ...entry, before, after, timestamp: new Date().toISOString() };
      if (!(await write(replay))) return;
      dispatchDocument({ type: 'apply', patch: after });
      dispatchHistory({ type: 'redo' });
      void reload();
    });
  }, [serial, write, reload, dispatchDocument, dispatchHistory]);

  return {
    document, history, execute, undo, redo,
    canUndo: canUndo(history), canRedo: canRedo(history),
    refusal, unreadable, loadFailed,
  };
}
