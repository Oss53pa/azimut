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

/** Ce qu'une passe d'axe a produit, tel que l'écran le rapporte. */
export type AxisReport = {
  readonly nodes: number;
  readonly edges: number;
  readonly reused: number;
  readonly skipped: number;
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
  /**
   * M4 (partie M), outil « Nœud » : « Le type se choisit avant le geste,
   * jamais après. » Le type que portera le prochain nœud posé, et le moyen de
   * le changer. Il était absent : l'écran posait des carrefours, et le type ne
   * se choisissait qu'après coup dans le panneau de propriétés, c'est-à-dire
   * exactement ce que la règle écarte. Un site entier pouvait ainsi être saisi
   * sans une entrée, et la validation le refusait sans que l'écran ait jamais
   * offert de faire autrement.
   */
  readonly nextNodeKind: NodeKind;
  readonly onNextNodeKind: (kind: NodeKind) => void;
  /**
   * Le geste se fait au pointeur dans la zone de travail, et au clavier par
   * cette action — E6.2 : « Toute opération réalisable au pointeur l'est au
   * clavier, y compris le dessin. »
   */
  readonly onPlaceNode: () => void;
  /** Outil « Arête » : relie les nœuds posés, deux à deux. */
  readonly onDrawEdges: () => void;
  /**
   * M4 (partie M), outil « Axe de circulation » : « Tracé continu produisant
   * nœuds et arêtes en une passe. »
   *
   * Les points se saisissent numériquement, comme les sommets d'une empreinte
   * dans M3 (partie M) : c'est le moyen le plus précis, et le seul accessible
   * au clavier tant que la zone de travail n'est pas construite.
   */
  readonly axis: readonly Point[];
  readonly onAxisPoint: (index: number, coordinate: 'x_m' | 'y_m', value: number | null) => void;
  readonly onAxisAdd: () => void;
  readonly onAxisRemove: () => void;
  readonly onAxisDraw: () => void;
  /** Ce que la dernière passe a produit, ou `null` si aucune n'a eu lieu. */
  readonly axisReport: AxisReport | null;
  /**
   * M4 (partie M) — « Propriétés d'un nœud », « Propriétés d'une arête ».
   *
   * Les deux panneaux existaient et n'étaient jamais atteints : la sélection
   * restait nulle, et aucun geste ne la posait. Libellé, position, largeur,
   * pente, sens et cheminement d'évacuation étaient spécifiés et inopérants.
   *
   * L'application est explicite plutôt qu'à la frappe : une commande par
   * caractère saisi remplirait la pile d'annulation d'un geste par touche, ce
   * que E5.2 écarte — « les commandes d'un même geste continu sont regroupées
   * en une seule entrée annulable ».
   */
  readonly onApplyProperties: () => void;
  readonly propertiesDirty: boolean;
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
        onAction: props.onPlaceNode,
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
              {props.selection !== null && (
                <Button
                  rank="primary"
                  onClick={props.onApplyProperties}
                  disabled={!props.propertiesDirty}
                >
                  {t('graph.action.apply')}
                </Button>
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

        <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'flex-end' }}>
          {/* M4 (partie M) : le type précède le geste, et se lit à côté de lui. */}
          <SelectField
            label={t('graph.node.kind.next')}
            value={props.nextNodeKind}
            options={NODE_KINDS.map(kind => ({ value: kind, label: t(nodeKindKey(kind)) }))}
            onChange={value => { props.onNextNodeKind(value as NodeKind); }}
            hint={t('graph.node.kind.next.hint')}
          />
          <Button rank="primary" onClick={props.onPlaceNode}>
            {t('graph.action.place_node')}
          </Button>
          <Button
            rank="secondary"
            onClick={props.onDrawEdges}
            // Une arête relie deux nœuds distincts (A5.3) : il en faut deux.
            disabled={props.nodeCount < 2}
          >
            {t('graph.action.draw_edges')}
          </Button>
        </div>

        <AxisFields
          axis={props.axis}
          onPoint={props.onAxisPoint}
          onAdd={props.onAxisAdd}
          onRemove={props.onAxisRemove}
          onDraw={props.onAxisDraw}
          report={props.axisReport}
        />

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

/**
 * M4 (partie M) — l'axe de circulation, saisi point par point.
 *
 * L'action est refusée sous deux points : un axe sans segment ne trace rien,
 * et laisser presser un bouton qui ne fera rien est pire que de le refuser en
 * le disant. Le compte rendu nomme ce que la passe a repris et ce qu'elle a
 * passé — « sans doublon » ne se voit pas autrement, le graphe ayant la même
 * allure qu'il ait doublé un nœud ou non.
 */
function AxisFields({ axis, onPoint, onAdd, onRemove, onDraw, report }: {
  readonly axis: readonly Point[];
  readonly onPoint: (index: number, coordinate: 'x_m' | 'y_m', value: number | null) => void;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
  readonly onDraw: () => void;
  readonly report: AxisReport | null;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
      <legend style={{ padding: 0, marginBottom: SPACE.sm }}>{t('graph.axis.title')}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.sm, alignItems: 'flex-end' }}>
        {axis.map((point, index) => (
          <div key={`axis-${String(index)}`} style={{ display: 'flex', gap: SPACE.sm }}>
            <NumericField
              label={t('graph.axis.point_x', { n: index + 1 })}
              unit={t('unit.metre')}
              value={point.x_m}
              step={0.001}
              onChange={value => { onPoint(index, 'x_m', value); }}
            />
            <NumericField
              label={t('graph.axis.point_y', { n: index + 1 })}
              unit={t('unit.metre')}
              value={point.y_m}
              step={0.001}
              onChange={value => { onPoint(index, 'y_m', value); }}
            />
          </div>
        ))}
      </div>
      <p style={{ margin: `${SPACE.sm} 0 0`, color: 'var(--text-muted)' }}>
        {t('graph.axis.hint')}
      </p>
      <div style={{ display: 'flex', gap: SPACE.sm, marginTop: SPACE.sm }}>
        <Button rank="secondary" onClick={onAdd}>{t('graph.axis.add')}</Button>
        <Button rank="secondary" onClick={onRemove} disabled={axis.length <= 2}>
          {t('graph.axis.remove')}
        </Button>
        <Button rank="primary" onClick={onDraw} disabled={axis.length < 2}>
          {t('graph.axis.draw')}
        </Button>
      </div>
      {report !== null && (
        <div style={{ marginTop: SPACE.sm }}>
          <StateBanner
            severity="info"
            message={t('graph.axis.done', {
              nodes: report.nodes, edges: report.edges,
              reused: report.reused, skipped: report.skipped,
            })}
          />
        </div>
      )}
    </fieldset>
  );
}
