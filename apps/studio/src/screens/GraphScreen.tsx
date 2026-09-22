import { type JSX } from 'react';
import {
  Panel, ScreenStates, Toolbar, StatusBar, TextField, SelectField,
  NumericField, Toggle, Button, StateBanner, SPACE,
} from '../components/ui/index.js';
import type { ScreenState, ToolbarItem, StatusItem } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode, Finding, NodeKind, Point } from '@azimut/core-model';
import {
  NODE_KINDS, EDGE_DIRECTIONS, SLOPE_MIN_PCT, SLOPE_MAX_PCT,
} from '../state/graph-input.js';
import type { EdgeDirection, EdgeRemedy } from '../state/graph-input.js';

/**
 * M4 (partie M) — écran de saisie du graphe.
 *
 * Deux panneaux de propriétés, un par nature d'objet, parce que M4 en donne
 * deux tableaux distincts. Le panneau visible suit la sélection.
 *
 * La longueur y figure en lecture seule, et son caractère calculé est visible
 * (M7.3, partie M) : « Un champ de longueur saisissable serait une source
 * permanente d'incohérence. »
 */
export const GRAPH_TOOLS = [
  { tool: 'node', key: 'N', labelKey: 'graph.tool.node' },
  { tool: 'edge', key: 'E', labelKey: 'graph.tool.edge' },
  { tool: 'axis', key: 'X', labelKey: 'graph.tool.axis' },
  { tool: 'vertical_link', key: 'L', labelKey: 'graph.tool.vertical_link' },
] as const;

export type GraphTool = (typeof GRAPH_TOOLS)[number]['tool'];

export type NodeSelection = {
  readonly kind: 'node';
  readonly nodeKind: NodeKind;
  readonly label: string;
  readonly position: Point;
};

export type EdgeSelection = {
  readonly kind: 'edge';
  readonly widthM: number;
  readonly slopePct: number;
  readonly accessible: boolean;
  readonly direction: EdgeDirection;
  readonly evacuationRoute: boolean;
  /** Calculée, jamais saisissable (M4, partie M ; A5.3). */
  readonly lengthM: number;
};

export type GraphScreenProps = {
  readonly state: ScreenState;
  readonly tool: GraphTool;
  readonly onTool: (tool: GraphTool) => void;
  readonly selection: NodeSelection | EdgeSelection | null;
  readonly onNodeKind: (kind: NodeKind) => void;
  readonly onNodeLabel: (label: string) => void;
  readonly onNodePosition: (axis: 'x_m' | 'y_m', value: number | null) => void;
  readonly onEdgeWidth: (value: number | null) => void;
  readonly onEdgeSlope: (value: number | null) => void;
  readonly onEdgeAccessible: (value: boolean) => void;
  readonly onEdgeDirection: (value: EdgeDirection) => void;
  readonly onEdgeEvacuation: (value: boolean) => void;
  readonly findings: readonly Finding[];
  /** La correction que le refus propose, quand il en sait une (M4, partie M). */
  readonly remedy: EdgeRemedy | null;
  readonly onApplyRemedy: () => void;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly children?: JSX.Element;
};

export function GraphScreen(props: GraphScreenProps): JSX.Element {
  const { t, lang } = useI18n();

  const tools: readonly ToolbarItem[] = GRAPH_TOOLS.map(item => ({
    id: item.tool,
    label: t(item.labelKey),
    key: item.key,
  }));

  const status: readonly StatusItem[] = [
    { id: 'nodes', label: t('graph.status.nodes'), value: String(props.nodeCount) },
    { id: 'edges', label: t('graph.status.edges'), value: String(props.edgeCount) },
  ];

  return (
    <ScreenStates
      state={props.state}
      // Même raison que M3 (partie M) : un écran d'atelier dont la zone de
      // travail disparaît quand il n'y a encore rien cache ce sur quoi
      // l'opérateur va travailler.
      emptyKeepsContent
      invitation={{
        message: t('graph.empty.message'),
        actionLabel: t('graph.empty.action'),
        onAction: () => { props.onTool('node'); },
      }}
      skeleton={<StateBanner severity="info" message={t('graph.loading')} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: SPACE.md, minHeight: 0 }}>
          <Toolbar
            label={t('graph.toolbar')}
            items={tools}
            active={props.tool}
            onSelect={id => { props.onTool(id as GraphTool); }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>{props.children}</div>

          <Panel title={t('graph.properties')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, padding: SPACE.md, minWidth: 260 }}>
              {props.selection === null && (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('graph.no_selection')}</p>
              )}

              {props.selection?.kind === 'node' && (
                <>
                  <SelectField
                    label={t('graph.node.kind')}
                    value={props.selection.nodeKind}
                    options={NODE_KINDS.map(kind => ({ value: kind, label: t(nodeKindKey(kind)) }))}
                    onChange={value => { props.onNodeKind(value as NodeKind); }}
                  />
                  <TextField
                    label={t('graph.node.label')}
                    value={props.selection.label}
                    onChange={props.onNodeLabel}
                    hint={t('graph.node.label.hint')}
                  />
                  <NumericField
                    label={t('graph.node.x')}
                    unit={t('unit.metre')}
                    value={props.selection.position.x_m}
                    step={0.001}
                    onChange={value => { props.onNodePosition('x_m', value); }}
                  />
                  <NumericField
                    label={t('graph.node.y')}
                    unit={t('unit.metre')}
                    value={props.selection.position.y_m}
                    step={0.001}
                    onChange={value => { props.onNodePosition('y_m', value); }}
                  />
                </>
              )}

              {props.selection?.kind === 'edge' && (
                <>
                  <NumericField
                    label={t('graph.edge.width')}
                    unit={t('unit.metre')}
                    value={props.selection.widthM}
                    step={0.01}
                    min={0.01}
                    onChange={props.onEdgeWidth}
                  />
                  <NumericField
                    label={t('graph.edge.slope')}
                    unit={t('unit.percent')}
                    value={props.selection.slopePct}
                    step={0.1}
                    min={SLOPE_MIN_PCT}
                    max={SLOPE_MAX_PCT}
                    onChange={props.onEdgeSlope}
                  />
                  <Toggle
                    label={t('graph.edge.accessible')}
                    checked={props.selection.accessible}
                    onChange={props.onEdgeAccessible}
                  />
                  <SelectField
                    label={t('graph.edge.direction')}
                    value={props.selection.direction}
                    options={EDGE_DIRECTIONS.map(d => ({ value: d, label: t(directionKey(d)) }))}
                    onChange={value => { props.onEdgeDirection(value as EdgeDirection); }}
                  />
                  <Toggle
                    label={t('graph.edge.evacuation')}
                    checked={props.selection.evacuationRoute}
                    onChange={props.onEdgeEvacuation}
                  />
                  {/* M4 (partie M) : jamais saisissable, recalculée à tout déplacement. */}
                  <NumericField
                    label={t('graph.edge.length')}
                    unit={t('unit.metre')}
                    value={props.selection.lengthM}
                    onChange={() => { /* lecture seule */ }}
                    computed
                    hint={t('graph.edge.length.hint')}
                  />
                </>
              )}
            </div>
          </Panel>
        </div>

        {props.findings.map(finding => (
          <StateBanner
            key={finding.code}
            severity="blocking"
            message={getErrorMessage(finding.code as ErrorCode, lang === 'en' ? 'en' : 'fr') ?? finding.code}
          />
        ))}

        {/* M4 (partie M) : « Refus, avec proposition de créer la liaison. » */}
        {props.remedy !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <StateBanner severity="info" message={t('graph.remedy.vertical_link')} />
            <Button rank="primary" onClick={props.onApplyRemedy}>
              {t('graph.remedy.action')}
            </Button>
          </div>
        )}

        <StatusBar items={status} />
      </div>
    </ScreenStates>
  );
}

function nodeKindKey(kind: NodeKind): `graph.node.kind.${NodeKind}` {
  return `graph.node.kind.${kind}`;
}

function directionKey(direction: EdgeDirection): `graph.edge.direction.${EdgeDirection}` {
  return `graph.edge.direction.${direction}`;
}
