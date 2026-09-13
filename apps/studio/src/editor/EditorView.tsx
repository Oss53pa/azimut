/**
 * E3 + E5 + E7 + E8 + E16 — Editor view, context 1.
 *
 * Assembles the editor over a real document: tool gestures, clipboard,
 * alignment, draw order and deletion all produce reversible commands
 * (E5.1) that the document applies, so undo and redo move geometry
 * rather than only popping a stack.
 *
 * Selection, pan, zoom and the active level are interface state and
 * never enter the undo stack (E5.2).
 *
 * All keyboard handling converges in useShortcuts (E16).
 */

import {
  type JSX,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { Point } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { EditorCanvas } from './EditorCanvas.js';
import type { EditorCanvasApi } from './EditorCanvas.js';
import type { SceneObject } from './snap-integration.js';
import type { SnapResult } from './snap.js';
import { FloorPlanScene } from './scene/FloorPlanScene.js';
import { DecorationScene } from './scene/DecorationScene.js';
import { selectionReducer, EMPTY_SELECTION } from './selection.js';
import { useClipboard } from './use-clipboard.js';
import { EMPTY_CLIPBOARD } from './clipboard.js';
import { AlignmentPanel } from './AlignmentPanel.js';
import { ShortcutHelpPanel } from './ShortcutHelpPanel.js';
import { useShortcuts } from './use-shortcuts.js';
import { StatusBar } from './StatusBar.js';
import { useRenderBudget } from './use-render-budget.js';
import { LevelTabs } from './LevelTabs.js';
import type { ToolId, ToolState } from './tool-state.js';
import { useEditorDocument } from './use-editor-document.js';
import { useEditorOperations } from './use-editor-operations.js';
import {
  levelSceneObjects,
  levelSelectableItems,
  shapesOfLevel,
} from './editor-document.js';
import { levelInitialView } from './level-view.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NO_SNAP: SnapResult = { point: { x_m: 0, y_m: 0 }, target: null };

const EMPTY_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-secondary)',
  fontSize: 13,
};

/** Live region announcing operation results (E6.3). */
function Announcer({ message }: { readonly message: string }): JSX.Element {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
        clipPath: 'inset(50%)',
      }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorView(): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const sortedLevels = useMemo(
    () => [...site.levels].sort((a, b) => a.ordinal - b.ordinal),
    [site],
  );

  const [selectedLevel, setSelectedLevel] = useState(sortedLevels[0]?.id ?? '');
  const [selection, dispatchSelection] = useReducer(selectionReducer, EMPTY_SELECTION);
  const [toolState, setToolState] = useState<ToolState | null>(null);
  const [snap, setSnap] = useState<SnapResult>(NO_SNAP);
  const renderMode = useRenderBudget();
  const [clipboard, setClipboard] = useState(EMPTY_CLIPBOARD);
  const [announcement, setAnnouncement] = useState('');
  const [requestedTool, setRequestedTool] = useState<ToolId | undefined>(undefined);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Framing is captured when a level is opened. Later edits must not
  // move the view under the operator's hands.
  const [initialView, setInitialView] = useState(
    () => levelInitialView(site, sortedLevels[0]?.id ?? '', []),
  );

  // ---- Document and history (E5) ----
  const documentApi = useEditorDocument(site.site.id);
  const { document, undo, redo, canUndo, canRedo } = documentApi;

  const operations = useEditorOperations({
    documentApi,
    orgId: site.organization.id,
    siteId: site.site.id,
    levelId: selectedLevel,
    selectedIds: selection.selectedIds,
    onAnnounce: setAnnouncement,
  });

  // ---- Level content ----
  const decorationShapes = useMemo(
    () => shapesOfLevel(document, selectedLevel),
    [document, selectedLevel],
  );

  const selectableItems = useMemo(
    () => levelSelectableItems(document, selectedLevel),
    [document, selectedLevel],
  );

  /** Snap targets: business footprints plus the habillage layer (E8.1). */
  const sceneObjects = useMemo((): readonly SceneObject[] => {
    if (selectedLevel === '') return [];
    const footprints = site.footprints
      .filter(f => f.level_id === selectedLevel)
      .map(f => ({ id: f.id, vertices: f.geometry.vertices }));
    return [...footprints, ...levelSceneObjects(document, selectedLevel)];
  }, [site, document, selectedLevel]);

  // ---- Canvas API ----
  const canvasApiRef = useRef<EditorCanvasApi | null>(null);
  const handleCanvasReady = useCallback((api: EditorCanvasApi) => {
    canvasApiRef.current = api;
  }, []);

  // ---- Clipboard (E7.3) ----
  const pasteContext = useMemo(() => ({
    targetOrgId: site.organization.id,
    targetSiteId: site.site.id,
    targetLevelId: selectedLevel,
  }), [site, selectedLevel]);

  const viewportCenter = useMemo((): Point => ({
    x_m: initialView?.centerX_m ?? 0,
    y_m: initialView?.centerY_m ?? 0,
  }), [initialView]);

  const handleCut = useCallback((ids: readonly string[]) => {
    operations.cut(ids);
    dispatchSelection({ type: 'clear' });
  }, [operations]);

  const clipboardActions = useClipboard({
    clipboard,
    setClipboard,
    selection,
    buildPayload: operations.buildPayload,
    pasteContext,
    viewportCenter,
    onPaste: operations.paste,
    onCut: handleCut,
  });

  const handlePaste = useCallback(() => {
    const result = clipboardActions.paste();
    if (result !== null && !result.ok) {
      setAnnouncement(t('editor.paste.refused', { code: result.finding.code }));
    }
  }, [clipboardActions, t]);

  // ---- Selection (E6) ----
  const handleSelect = useCallback((id: string, additive: boolean) => {
    dispatchSelection(additive ? { type: 'toggle', id } : { type: 'select', id });
  }, []);

  const handleSelectAll = useCallback(() => {
    dispatchSelection({ type: 'select_all', ids: selectableItems.map(i => i.id) });
  }, [selectableItems]);

  const handleDeselect = useCallback(() => {
    dispatchSelection({ type: 'clear' });
    setShowShortcuts(false);
  }, []);

  const handleNavigate = useCallback((direction: 'next' | 'prev') => {
    dispatchSelection({ type: 'navigate', direction, items: selectableItems });
  }, [selectableItems]);

  const handleLevelChange = useCallback((levelId: string) => {
    setSelectedLevel(levelId);
    setInitialView(levelInitialView(site, levelId, shapesOfLevel(document, levelId)));
    dispatchSelection({ type: 'clear' });
  }, [site, document]);

  // ---- Deletion (E7.3) ----
  const handleDelete = useCallback(() => {
    if (selection.selectedIds.length === 0) return;
    operations.deleteSelected();
    dispatchSelection({ type: 'clear' });
  }, [selection.selectedIds, operations]);

  // ---- Shortcut dispatcher (E16) — sole keyboard handler ----
  useShortcuts({
    onUndo: undo,
    onRedo: redo,
    onCopy: clipboardActions.copy,
    onCut: clipboardActions.cut,
    onPaste: handlePaste,
    onDelete: handleDelete,
    onSelectAll: handleSelectAll,
    onDeselect: handleDeselect,
    onNavigateNext: () => handleNavigate('next'),
    onNavigatePrev: () => handleNavigate('prev'),
    onToolSwitch: setRequestedTool,
    onShowHelp: () => setShowShortcuts(prev => !prev),
    onZoomIn: () => canvasApiRef.current?.zoomIn(),
    onZoomOut: () => canvasApiRef.current?.zoomOut(),
    onZoomFit: () => canvasApiRef.current?.zoomFit(),
  });

  const levelName = sortedLevels.find(l => l.id === selectedLevel)?.name ?? selectedLevel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <LevelTabs
        levels={sortedLevels}
        selectedId={selectedLevel}
        onSelect={handleLevelChange}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        {selectedLevel !== '' ? (
          <EditorCanvas
            initialView={initialView}
            sceneObjects={sceneObjects}
            requestedTool={requestedTool}
            onToolChange={setToolState}
            onReady={handleCanvasReady}
            onGestureCommit={operations.commitShape}
            onPointerSnap={setSnap}
            ariaLabel={t('editor.canvas.aria', { level: levelName })}
          >
            <FloorPlanScene
              site={site}
              levelId={selectedLevel}
              selectedIds={selection.selectedIds}
              onSelect={handleSelect}
            />
            <DecorationScene
              shapes={decorationShapes}
              selectedIds={selection.selectedIds}
              activeId={selection.activeId}
              onSelect={handleSelect}
            />
          </EditorCanvas>
        ) : (
          <div style={EMPTY_STYLE}>{t('floorplans.empty')}</div>
        )}
      </div>

      <AlignmentPanel
        selectedCount={selection.selectedIds.length}
        onAlign={operations.align}
        onDistribute={operations.distribute}
        onZOrder={operations.setZOrder}
      />

      <StatusBar
        currentTool={toolState?.currentTool ?? 'select'}
        cursorPosition={snap.point}
        snapResult={snap}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        renderMode={renderMode}
      />

      <ShortcutHelpPanel
        visible={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      <Announcer message={announcement} />
    </div>
  );
}
