import { type JSX, useMemo, useState, useCallback, useReducer } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import type { ViewState } from '@azimut/core-model';
import { Viewport } from '../editor/Viewport.js';
import { FloorPlanScene } from '../editor/scene/FloorPlanScene.js';
import { selectionReducer, EMPTY_SELECTION } from '../editor/selection.js';

export function FloorPlansView(): JSX.Element {
  const site = useSiteData();
  const sortedLevels = useMemo(
    () => [...site.levels].sort((a, b) => a.ordinal - b.ordinal),
    [site],
  );
  const [selectedLevel, setSelectedLevel] = useState(sortedLevels[0]?.id ?? '');
  const [selection, dispatchSelection] = useReducer(selectionReducer, EMPTY_SELECTION);

  // Compute initial view to fit the level's content
  const initialView = useMemo((): ViewState | undefined => {
    if (!selectedLevel) return undefined;
    const levelFootprints = site.footprints.filter((f) => f.level_id === selectedLevel);
    const levelNodes = site.graph.nodes.filter((n) => n.level_id === selectedLevel);

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
    if (additive) {
      dispatchSelection({ type: 'toggle', id });
    } else {
      dispatchSelection({ type: 'select', id });
    }
  }, []);

  const handleLevelChange = useCallback((levelId: string) => {
    setSelectedLevel(levelId);
    dispatchSelection({ type: 'clear' });
  }, []);

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Plans de niveaux
      </h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {sortedLevels.map((l) => (
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

      <div
        style={{
          borderRadius: 8,
          border: '1px solid var(--az-border)',
          overflow: 'hidden',
          height: 500,
        }}
      >
        {selectedLevel ? (
          <Viewport
            initialView={initialView}
            ariaLabel={`Plan du niveau ${sortedLevels.find((l) => l.id === selectedLevel)?.name ?? selectedLevel}`}
          >
            <FloorPlanScene
              site={site}
              levelId={selectedLevel}
              selectedIds={selection.selectedIds}
              onSelect={handleSelect}
            />
          </Viewport>
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

      {selection.selectedIds.length > 0 && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          borderRadius: 6,
          background: 'var(--az-card-bg)',
          border: '1px solid var(--az-border)',
          fontSize: 12,
          color: 'var(--az-text-secondary)',
        }}>
          Sélection : {selection.selectedIds.join(', ')}
        </div>
      )}
    </div>
  );
}
