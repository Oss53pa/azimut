import { type JSX } from 'react';
import {
  Panel, SelectField, NumericField, Toggle, Button, StateBanner, SPACE,
} from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { VERTICAL_LINK_KINDS } from '../state/graph-input.js';
import type { VerticalLinkKind } from '../state/graph-input.js';

/**
 * M4 (partie M), outil « Liaison verticale » : « Relie deux nœuds de niveaux
 * différents. »
 *
 * À part dans un fichier : `GraphScreen` frôlait les quatre cents lignes
 * qu'A2.4 fixe, et un panneau de plus l'aurait fait passer outre.
 *
 * Deux extrémités, et l'outil n'en pose aucune. Le nœud de départ est celui
 * que la sélection désigne dans la zone de travail, sur le niveau courant ; le
 * nœud d'arrivée se choisit parmi ceux du niveau visé. Une liaison verticale
 * relie un lieu réel du relevé au lieu qui lui correspond à l'étage : en
 * inventer un placerait une cage d'ascenseur là où personne ne l'a vue.
 *
 * Quand le site n'a qu'un niveau, l'outil ne se présente pas actif et muet :
 * il dit pourquoi il ne peut rien faire. M7 (partie M), règle 11 — « Aucun résultat vide
 * n'est présenté comme un succès si le calcul n'a pas eu lieu. »
 */

/** Un niveau que la session porte, tel que l'écran le propose. */
export type LinkableLevel = {
  readonly id: string;
  readonly name: string;
};

/** Un nœud du niveau visé, tel que l'écran le propose. */
export type LinkableNode = {
  readonly id: string;
  readonly label: string;
};

export type VerticalLinkFieldsProps = {
  /** Les niveaux du site autres que le niveau courant. */
  readonly levels: readonly LinkableLevel[];
  readonly targetLevelId: string;
  readonly onTargetLevel: (id: string) => void;
  /** Les nœuds du niveau visé. Vide quand il n'en porte aucun. */
  readonly targetNodes: readonly LinkableNode[];
  readonly targetNodeId: string;
  readonly onTargetNode: (id: string) => void;
  /** Le nœud de départ, désigné par la sélection. `null` quand rien n'est pris. */
  readonly fromNodeLabel: string | null;
  readonly kind: VerticalLinkKind;
  readonly onKind: (kind: VerticalLinkKind) => void;
  readonly accessible: boolean;
  readonly onAccessible: (value: boolean) => void;
  readonly capacity: number;
  readonly onCapacity: (value: number | null) => void;
  /**
   * M01.S10 — les deux extrémités franchissent une limite de bâtiment, et la
   * liaison inter-bâtiments part avec l'arête. Le champ n'apparaît que dans ce
   * cas : une passerelle déclare si elle est couverte, un escalier interne n'a
   * rien à déclarer.
   */
  readonly crossesBuildings: boolean;
  readonly sheltered: boolean;
  readonly onSheltered: (value: boolean) => void;
  readonly onCreate: () => void;
};

export function VerticalLinkFields(props: VerticalLinkFieldsProps): JSX.Element {
  const { t } = useI18n();

  if (props.levels.length === 0) {
    return (
      <Panel title={t('graph.link.title')}>
        <div style={{ padding: SPACE.md }}>
          <StateBanner severity="info" message={t('graph.link.no_other_level')} />
        </div>
      </Panel>
    );
  }

  const ready = props.fromNodeLabel !== null && props.targetNodeId !== '';

  return (
    <Panel title={t('graph.link.title')}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end',
        gap: SPACE.sm, padding: SPACE.md,
      }}
      >
        <p style={{ margin: 0, minWidth: 200, color: 'var(--text-muted)' }}>
          {props.fromNodeLabel === null
            ? t('graph.link.pick_source')
            : t('graph.link.source', { node: props.fromNodeLabel })}
        </p>

        <SelectField
          label={t('graph.link.level')}
          value={props.targetLevelId}
          options={props.levels.map(level => ({ value: level.id, label: level.name }))}
          onChange={props.onTargetLevel}
        />

        {/*
          Un niveau sans nœud ne peut porter aucune extrémité. Le sélecteur le
          dit plutôt que de s'afficher vide : une liste vide laisse croire à un
          chargement en cours.
        */}
        {props.targetNodes.length === 0 ? (
          <StateBanner severity="info" message={t('graph.link.no_node_on_level')} />
        ) : (
          <SelectField
            label={t('graph.link.node')}
            value={props.targetNodeId}
            options={props.targetNodes.map(node => ({ value: node.id, label: node.label }))}
            onChange={props.onTargetNode}
          />
        )}

        <SelectField
          label={t('graph.link.kind')}
          value={props.kind}
          options={VERTICAL_LINK_KINDS.map(kind => ({
            value: kind, label: t(linkKindKey(kind)),
          }))}
          onChange={value => { props.onKind(value as VerticalLinkKind); }}
        />

        <Toggle
          label={t('graph.link.accessible')}
          checked={props.accessible}
          onChange={props.onAccessible}
        />

        <NumericField
          label={t('graph.link.capacity')}
          unit={t('unit.person')}
          value={props.capacity}
          step={1}
          min={1}
          onChange={props.onCapacity}
          hint={t('graph.link.capacity.hint')}
        />

        {props.crossesBuildings && (
          <Toggle
            label={t('graph.link.sheltered')}
            checked={props.sheltered}
            onChange={props.onSheltered}
            hint={t('graph.link.sheltered.hint')}
          />
        )}

        <Button rank="primary" onClick={props.onCreate} disabled={!ready}>
          {t('graph.link.action')}
        </Button>
      </div>
    </Panel>
  );
}

function linkKindKey(kind: VerticalLinkKind): `graph.link.kind.${VerticalLinkKind}` {
  return `graph.link.kind.${kind}`;
}
