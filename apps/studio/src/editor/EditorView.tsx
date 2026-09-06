/**
 * E3 + E7 + E8 — Full editor view.
 *
 * Assembles EditorCanvas with FloorPlanScene and editing context.
 * This is the top-level view for editing site geometry (context 1).
 *
 * Replaces the read-only FloorPlansView when editing mode is active.
 */

import {
  type JSX,
  useCallback,
  useMemo,
  useReducer,
  useState,
} from 'react';
import type { ViewState, Footprint } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { EditorCanvas } from './EditorCanvas.js';
import type { SceneObject } from './snap-integration.js';
import { FloorPlanScene } from './scene/FloorPlanScene.js';
import { selectionReducer, EMPTY_SELECTION } from './selection.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert footprints to SceneObjects for the snap pipeline.
 */
function footprintsToSceneObjects(
  footprints: readonly Footprint[],
): readonly SceneObject[] {
  return footprints.map(fp => ({
    id: fp.id,
    vertices: fp.geometry.vertices,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorView(): JSX.Element {
  const site = useSiteData();
  const sortedLevels = useMemo(
    () => [...site.levels].sort((a, b) => a.ordinal - b.ordinal),
    [site],
  );

  const [selectedLevel, setSelectedLevel] = useState(sortedLevels[0]?.id ?? '');
  const [selection, dispatchSelection] = useReducer(selectionReducer, EMPTY_SELECTION);

  // Scene objects for snap pipeline
  const sceneObjects = useMemo(() => {
    if (selectedLevel === '') return [];
    const levelFootprints = site.footprints.filter(f => f.level_id === selectedLevel);
    return footprintsToSceneObjects(levelFootprints);
  }, [site, selectedLevel]);

  // Initial view to fit level content
  const initialView = useMemo((): ViewState | undefined => {
    if (selectedLevel === '') return undefined;
    const levelFootprints = site.footprints.filter(f => f.level_id === selectedLevel);
    const levelNodes = site.graph.nodes.filter(n => n.level_id === selectedLevel);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasPoints = false;

    for (const fp of levelFootprints) {
      for (const v of fp.geometry.vertices) {
        minX = Math.min(minX, v.x_m);
        minY = Math.min(minY, v.y_m);
        maxX = Math.max(maxX, v.x_m);
        maxY = Math.max(maxY, v.y_m);
        hasPoints = true;
      }
    }
    for (const n of levelNodes) {
      minX = Math.min(minX, n.position.x_m);
      minY = Math.min(minY, n.position.y_m);
      maxX = Math.max(maxX, n.position.x_m);
      maxY = Math.max(maxY, n.position.y_m);
      hasPoints = true;
    }

    if (!hasPoints) return undefined;

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const scale = Math.min(700 / Math.max(spanX, 0.1), 400 / Math.max(spanY, 0.1)) * 0.85;

    return {
      centerX_m: (minX + maxX) / 2,
      centerY_m: (minY + maxY) / 2,
      scale_px_per_m: Math.max(0.05, Math.min(500, scale)),
      rotationDeg: 0,
    };
  }, [site, selectedLevel]);

  const handleSelect = useCallback((id: string, additive: boolean) => {
    dispatchSelection(additive ? { type: 'toggle', id } : { type: 'select', id });
  }, []);

  const handleLevelChange = useCallback((levelId: string) => {
    setSelectedLevel(levelId);
    dispatchSelection({ type: 'clear' });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Level selector */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', flexShrink: 0 }}>
        {sortedLevels.map(l => (
          <button
            key={l.id}
            onClick={() => handleLevelChange(l.id)}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--az-border)',
              borderRadius: 6,
              background: selectedLevel === l.id ? 'var(--az-active-bg)' : 'var(--az-card-bg)',
              color: selectedLevel === l.id ? 'var(--az-active-text)' : 'var(--az-text-primary)',
              fontWeight: selectedLevel === l.id ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* Editor canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {selectedLevel !== '' ? (
          <EditorCanvas
            initialView={initialView}
            sceneObjects={sceneObjects}
            ariaLabel={`Éditeur: ${sortedLevels.find(l => l.id === selectedLevel)?.name ?? selectedLevel}`}
          >
            <FloorPlanScene
              site={site}
              levelId={selectedLevel}
              selectedIds={selection.selectedIds}
              onSelect={handleSelect}
            />
          </EditorCanvas>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--az-text-secondary)',
            fontSize: 14,
          }}>
            Sélectionnez un niveau.
          </div>
        )}
      </div>

      {/* Selection info */}
      {selection.selectedIds.length > 0 && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--az-border)',
          background: 'var(--az-card-bg)',
          fontSize: 12,
          color: 'var(--az-text-secondary)',
          flexShrink: 0,
        }}>
          Sélection : {selection.selectedIds.join(', ')}
        </div>
      )}
    </div>
  );
}
