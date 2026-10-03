import { useState } from 'react';
import type { Finding, Level, Point } from '@azimut/core-model';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { acceptVerticalLink } from '../state/graph-vertical-link.js';
import { graphCommands } from '../state/graph-commands.js';
import { inheritedEdgeWidthM } from '../state/edge-width.js';
import type { VerticalLinkKind } from '../state/graph-input.js';
import type { SessionGraph } from '../state/session-graph.js';
import type { VerticalLinkFieldsProps } from '../screens/VerticalLinkFields.js';

/**
 * T-1.5 et M4 (partie M) — l'outil « Liaison verticale ».
 *
 * Hors de `GraphAdapter` pour une raison tenue par A2.4 : l'adaptateur
 * approchait des quatre cents lignes, et l'outil en demande une soixantaine à
 * lui seul. Le partage suit une ligne de sens et pas seulement une ligne de
 * compte — tout ce qui tient à la liaison est ici, l'adaptateur n'en garde que
 * le branchement.
 *
 * L'outil n'écrit qu'un couple : l'arête inter-niveaux et la liaison qui la
 * justifie, dans un seul groupe d'annulation. A5.3 : « Une arête entre deux
 * niveaux différents doit avoir une ligne `vertical_link`. » Les écrire en
 * deux gestes laisserait, entre les deux, un état que la validation refuse —
 * et qu'une annulation pourrait figer.
 */

/**
 * La capacité proposée à l'ouverture.
 *
 * Ce n'est pas une valeur choisie ici : c'est le défaut de la colonne,
 * `capacity integer NOT NULL DEFAULT 1` (migration 0004). La colonne étant
 * non nulle, l'absence de capacité n'est pas représentable, et proposer autre
 * chose que son défaut ferait diverger l'écran de la base.
 */
const SCHEMA_DEFAULT_CAPACITY = 1;

export type VerticalLinkTool = {
  readonly fields: (context: {
    readonly levelId: string;
    readonly levels: readonly Level[];
    readonly graph: SessionGraph;
    readonly fromNodeId: string | null;
  }) => VerticalLinkFieldsProps;
  readonly findings: readonly Finding[];
};

export function useVerticalLinkTool(session: TrancheSession): VerticalLinkTool {
  const [targetLevelId, setTargetLevelId] = useState('');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [kind, setKind] = useState<VerticalLinkKind>('elevator');
  const [accessible, setAccessible] = useState(true);
  // M01.S10 : « qui déclare si le passage est couvert ». Faux par défaut, comme
  // la colonne (migration 0004) : un cheminement extérieur non couvert est le
  // cas qui change le parcours réel, et le supposer couvert l'effacerait.
  const [sheltered, setSheltered] = useState(false);
  const [capacity, setCapacity] = useState(SCHEMA_DEFAULT_CAPACITY);
  const [findings, setFindings] = useState<readonly Finding[]>([]);

  function fields(context: {
    readonly levelId: string;
    readonly levels: readonly Level[];
    readonly graph: SessionGraph;
    readonly fromNodeId: string | null;
  }): VerticalLinkFieldsProps {
    const others = context.levels.filter(level => level.id !== context.levelId);
    // Le niveau visé n'est pas mémorisé d'office : tant que l'opérateur n'en a
    // pas choisi un, c'est le premier de la liste qui est proposé, et changer
    // de niveau courant ne laisse pas l'outil pointer sur le niveau qu'on
    // vient de quitter.
    const chosenLevel = others.some(level => level.id === targetLevelId)
      ? targetLevelId
      : others[0]?.id ?? '';

    const to = context.graph.nodes.find(node => node.id === targetNodeId);
    const targetNodes = context.graph.nodes
      .filter(node => node.level_id === chosenLevel)
      .map(node => ({
        id: node.id,
        label: node.label === '' ? node.id : node.label,
      }));
    const chosenNode = targetNodes.some(node => node.id === targetNodeId)
      ? targetNodeId
      : '';

    const from = context.fromNodeId === null
      ? undefined
      : context.graph.nodes.find(node => node.id === context.fromNodeId);

    return {
      levels: others.map(level => ({ id: level.id, name: level.name })),
      targetLevelId: chosenLevel,
      onTargetLevel: id => { setTargetLevelId(id); setTargetNodeId(''); },
      targetNodes,
      targetNodeId: chosenNode,
      onTargetNode: setTargetNodeId,
      fromNodeLabel: from === undefined
        ? null
        : (from.label === '' ? from.id : from.label),
      kind,
      onKind: setKind,
      accessible,
      onAccessible: setAccessible,
      capacity,
      onCapacity: value => { setCapacity(value ?? SCHEMA_DEFAULT_CAPACITY); },
      crossesBuildings: from !== undefined && to !== undefined
        && buildingOf(from.level_id, context.levels) !== buildingOf(to.level_id, context.levels),
      sheltered,
      onSheltered: setSheltered,
      onCreate: () => {
        void create({
          levelId: context.levelId,
          levels: context.levels,
          graph: context.graph,
          fromNodeId: context.fromNodeId,
          toNodeId: chosenNode,
        });
      },
    };
  }

  async function create(context: {
    readonly levelId: string;
    readonly levels: readonly Level[];
    readonly graph: SessionGraph;
    readonly fromNodeId: string | null;
    readonly toNodeId: string;
  }): Promise<void> {
    const from = context.graph.nodes.find(n => n.id === context.fromNodeId);
    const to = context.graph.nodes.find(n => n.id === context.toNodeId);
    if (from === undefined || to === undefined) return;

    const outcome = acceptVerticalLink({
      from: end(from.id, from.level_id, from.position, context.levels),
      to: end(to.id, to.level_id, to.position, context.levels),
      kind,
      accessible,
      capacity,
      // M4 (partie M) : la largeur utile est héritée du bâtiment. Une liaison
      // verticale est une arête, et elle hérite comme les autres — de son
      // bâtiment de départ, celui du niveau où l'opérateur travaille. Une
      // passerelle en relie deux, qui peuvent déclarer deux largeurs ; retenir
      // celle du départ suit le geste, et la largeur reste modifiable au
      // panneau de l'arête.
      widthM: inheritedEdgeWidthM(session.state, context.levelId),
      direction: 'both',
      sheltered,
    });
    if (!outcome.ok) { setFindings(outcome.findings); return; }

    const edgeId = session.newId();
    const commands = graphCommands(
      [],
      [{ id: edgeId, edge: outcome.value.edge }],
      [{
        id: session.newId(),
        edgeId,
        kind: outcome.value.kind,
        accessible: outcome.value.accessible,
        capacity: outcome.value.capacity,
      }],
      { orgId: ORG_OF_SESSION, levelId: context.levelId, timestamp: session.now() },
      `vertical-link:${edgeId}`,
      // M01.S10 : l'arête qui franchit une limite de bâtiment part avec sa
      // ligne, dans le même geste. Les écrire en deux temps laisserait entre
      // les deux l'état que la validation refuse.
      outcome.value.buildingLink === null
        ? []
        : [{
          id: session.newId(),
          edgeId,
          fromBuildingId: outcome.value.buildingLink.fromBuildingId,
          toBuildingId: outcome.value.buildingLink.toBuildingId,
          sheltered: outcome.value.buildingLink.sheltered,
        }],
    );
    if (!commands.ok) { setFindings(commands.findings); return; }
    await session.write(commands.value);
    setFindings([]);
  }

  return { fields, findings };
}

/**
 * L'altitude d'une extrémité vient de son niveau, jamais de zéro.
 *
 * `edgeLengthBetween` est tridimensionnelle : deux nœuds superposés à
 * l'aplomb l'un de l'autre, tous deux posés à l'altitude zéro, donneraient une
 * longueur nulle et la liaison serait refusée — alors que c'est exactement la
 * liaison que `GRAPH.VERTICAL_LINK_MISALIGNED` (D2.2) veut voir.
 */
function end(
  nodeId: string,
  levelId: string,
  position: Point,
  levels: readonly Level[],
): {
  nodeId: string; levelId: string; buildingId: string;
  position: Point; elevationM: number;
} {
  return {
    nodeId,
    levelId,
    buildingId: buildingOf(levelId, levels),
    position,
    elevationM: levels.find(level => level.id === levelId)?.elevation_m ?? 0,
  };
}

/**
 * Le bâtiment d'un niveau, ou la chaîne vide quand la session ne le porte pas.
 *
 * Deux extrémités de bâtiment inconnu se valent alors, donc ne franchissent
 * aucune limite : c'est le comportement voulu, le moteur signalant par
 * ailleurs le niveau manquant.
 */
function buildingOf(levelId: string, levels: readonly Level[]): string {
  return levels.find(level => level.id === levelId)?.building_id ?? '';
}
