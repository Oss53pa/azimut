/**
 * E3.4 — SVG DOM rendering of a floor plan level.
 *
 * Each footprint, node, and edge is a real SVG element with native
 * hit-testing and accessibility attributes. No dangerouslySetInnerHTML.
 *
 * Coordinates are in meter-space — the parent Viewport's <g transform>
 * handles the view transform. This component never computes its own
 * coordinate conversion (E3.1).
 */

import { type JSX, useMemo } from 'react';
import type { SiteData, Footprint, GraphNode, Edge, Destination } from '@azimut/core-model';
import { formatSvg } from '@azimut/core-model';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type FloorPlanSceneProps = {
  readonly site: SiteData;
  readonly levelId: string;
  readonly selectedIds: readonly string[];
  readonly onSelect?: (id: string, additive: boolean) => void;
  readonly showEdges?: boolean;
  readonly showDestinations?: boolean;
};

// ---------------------------------------------------------------------------
// Data extraction (per level)
// ---------------------------------------------------------------------------

type LevelData = {
  readonly footprints: readonly Footprint[];
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly Edge[];
  readonly destinations: readonly Destination[];
  readonly nodeMap: ReadonlyMap<string, GraphNode>;
};

function extractLevelData(site: SiteData, levelId: string): LevelData {
  const footprints = site.footprints
    .filter((f) => f.level_id === levelId)
    .sort((a, b) => a.id.localeCompare(b.id));

  const nodes = site.graph.nodes
    .filter((n) => n.level_id === levelId)
    .sort((a, b) => a.id.localeCompare(b.id));

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const edges = site.graph.edges
    .filter((e) => nodeIdSet.has(e.from_node_id) && nodeIdSet.has(e.to_node_id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const destinations = site.destinations
    .filter((d) => nodeIdSet.has(d.node_id))
    .sort((a, b) => a.display_priority - b.display_priority || a.id.localeCompare(b.id));

  return { footprints, nodes, edges, destinations, nodeMap };
}

// ---------------------------------------------------------------------------
// Safety kinds (same as engine-layout, duplicated to avoid coupling)
// ---------------------------------------------------------------------------

const SAFETY_KINDS = new Set(['emergency_exit', 'security_post']);

function nodeRadius(kind: string): number {
  if (kind === 'entrance') return 0.6;
  if (kind === 'elevator' || kind === 'stair' || kind === 'escalator') return 0.5;
  if (SAFETY_KINDS.has(kind)) return 0.5;
  if (kind === 'destination_access') return 0.4;
  return 0.3;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FloorPlanScene({
  site,
  levelId,
  selectedIds,
  onSelect,
  showEdges = true,
  showDestinations = true,
}: FloorPlanSceneProps): JSX.Element {
  const data = useMemo(() => extractLevelData(site, levelId), [site, levelId]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const handleClick = (id: string, e: React.MouseEvent): void => {
    onSelect?.(id, e.ctrlKey || e.metaKey);
  };

  return (
    <g data-scene="floor-plan" data-level={levelId}>
      {/* Footprints (back) */}
      <g data-layer="footprints">
        {data.footprints.map((fp) => {
          const points = fp.geometry.vertices
            .map((v) => `${formatSvg(v.x_m)},${formatSvg(v.y_m)}`)
            .join(' ');
          const isSelected = selectedSet.has(fp.id);

          return (
            <polygon
              key={fp.id}
              data-id={fp.id}
              data-kind={fp.kind}
              points={points}
              fill="var(--az-card-bg)"
              stroke={isSelected ? 'var(--az-active-bg)' : 'var(--az-text-secondary)'}
              strokeWidth={isSelected ? 0.15 : 0.05}
              style={{ cursor: 'pointer' }}
              role="graphics-symbol"
              aria-label={`Empreinte ${fp.kind} ${fp.id}`}
              onClick={(e) => handleClick(fp.id, e)}
            />
          );
        })}
      </g>

      {/* Edges */}
      {showEdges && (
        <g data-layer="edges">
          {data.edges.map((edge) => {
            const from = data.nodeMap.get(edge.from_node_id);
            const to = data.nodeMap.get(edge.to_node_id);
            if (!from || !to) return null;
            const isSelected = selectedSet.has(edge.id);

            return (
              <line
                key={edge.id}
                data-id={edge.id}
                x1={formatSvg(from.position.x_m)}
                y1={formatSvg(from.position.y_m)}
                x2={formatSvg(to.position.x_m)}
                y2={formatSvg(to.position.y_m)}
                stroke={isSelected ? 'var(--az-active-bg)' : 'var(--az-text-secondary)'}
                strokeWidth={isSelected ? 0.15 : 0.08}
                strokeDasharray={edge.evacuation_route ? '0.3 0.15' : undefined}
                style={{ cursor: 'pointer' }}
                role="graphics-symbol"
                aria-label={`Arête ${edge.id}`}
                onClick={(e) => handleClick(edge.id, e)}
              />
            );
          })}
        </g>
      )}

      {/* Nodes */}
      <g data-layer="nodes">
        {data.nodes.map((node) => {
          const r = nodeRadius(node.kind);
          const isSelected = selectedSet.has(node.id);
          const fill = SAFETY_KINDS.has(node.kind)
            ? 'var(--az-active-text)'
            : 'var(--az-active-bg)';

          return (
            <circle
              key={node.id}
              data-id={node.id}
              data-kind={node.kind}
              cx={formatSvg(node.position.x_m)}
              cy={formatSvg(node.position.y_m)}
              r={r}
              fill={fill}
              stroke={isSelected ? 'var(--az-active-text)' : 'var(--az-text-primary)'}
              strokeWidth={isSelected ? 0.1 : 0.03}
              style={{ cursor: 'pointer' }}
              role="graphics-symbol"
              aria-label={`Nœud ${node.kind} ${node.label ?? node.id}`}
              tabIndex={0}
              onClick={(e) => handleClick(node.id, e)}
            />
          );
        })}
      </g>

      {/* Destination labels */}
      {showDestinations && (
        <g data-layer="destinations">
          {data.destinations.map((dest) => {
            const node = data.nodeMap.get(dest.node_id);
            if (!node) return null;

            return (
              <text
                key={dest.id}
                data-id={dest.id}
                x={formatSvg(node.position.x_m)}
                y={formatSvg(node.position.y_m - 1)}
                textAnchor="middle"
                fontSize={0.8}
                fill="var(--az-text-primary)"
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                role="graphics-symbol"
                aria-label={`Destination ${dest.occupant_name}`}
                onClick={(e) => handleClick(dest.id, e)}
              >
                {dest.occupant_name}
              </text>
            );
          })}
        </g>
      )}
    </g>
  );
}
