import { type JSX, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import { computeGraphHash } from '@azimut/engine-graph';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { readSessionGraph } from '../state/session-graph.js';
import type { SessionGraph } from '../state/session-graph.js';
import { writeGraphValidation } from '../state/graph-validation-commands.js';
import { ValidationScreen } from '../screens/ValidationScreen.js';
import { NEVER_RUN } from '../state/validation-report.js';
import type { ValidationState } from '../state/validation-report.js';

/**
 * L'écran de validation.
 *
 * Il ne fait pas encore tourner `runChecks` : le moteur consomme `SiteData`,
 * et assembler cette structure depuis la session — un site, un niveau, des
 * empreintes, des nœuds, des arêtes, et tout ce que `SiteData` porte en plus —
 * est le morceau qui manque. Tant qu'il manque, l'écran dit honnêtement qu'il
 * a tourné sans rien trouver, plutôt que de fabriquer des anomalies : une
 * fixture en production est précisément ce qu'on ne veut pas.
 */
/**
 * M5 (partie M) — « Relancer | Recalcule, affiche la durée réelle, enregistre
 * le passage dans `graph_validation`. »
 *
 * L'enregistrement est ce qui distingue cet écran d'un calcul jetable : la
 * règle M02.W11 lit le dernier passage du site et son empreinte de graphe, et
 * sans trace elle n'avait rien à lire.
 *
 * La validation porte sur le graphe que la session contient, lu par le même
 * chemin que celui qui l'a écrit. Aucun paquet de règles n'est rattaché dans
 * le parcours de M8 : aucune anomalie normative n'est donc levée, et l'écran
 * dit ce qu'il a vu, pas ce qu'il aurait vu sous un paquet.
 */
export function ValidationScreenAdapter({ session, siteId }: {
  readonly session: TrancheSession;
  readonly siteId: string;
}): JSX.Element {
  const [validation, setValidation] = useState<ValidationState>(NEVER_RUN);

  return (
    <ValidationScreen
      state={{ kind: 'ready' }}
      validation={validation}
      coverageRatePct={null}
      rulesPack={null}
      onRun={() => {
        const started = performance.now();
        const graph = readSessionGraph(session.state);
        const findings: Finding[] = [];

        // Une ligne du magasin qui ne se relit pas est un fait, pas un détail
        // de lecture : valider un graphe amputé reviendrait à valider ce que
        // personne n'a saisi.
        for (const id of graph.unreadable) {
          findings.push({
            code: 'EDIT.COMMAND_SHAPE_INVALID',
            severity: 'blocking',
            entity: { kind: 'graph_row', id },
            params: {},
            ruleRef: null,
          });
        }

        findings.push(...structuralFindings(graph));

        const ranAt = session.now();
        setValidation({
          kind: 'ran',
          findings,
          ranAt,
          durationMs: Math.round(performance.now() - started),
        });

        const command = writeGraphValidation(findings, {
          orgId: ORG_OF_SESSION,
          siteId,
          id: session.newId(),
          timestamp: ranAt,
          graphHash: computeGraphHash(graph),
        });
        // `record` et non `write` : un passage de validation ne s'annule pas.
        // La table est en insertion seule (A12.3) et l'inverse de son
        // insertion serait une suppression que la base refuse. L'empiler
        // offrirait une annulation qui échouerait à l'exécution.
        if (command.ok) void session.record([command.value]);
      }}
      onOpen={() => { /* le lien ouvre la zone de travail, non construite */ }}
      onExport={() => { /* l'export passe par prepareExport */ }}
    />
  );
}

/**
 * Les contrôles de A7.1 que le graphe seul permet de trancher.
 *
 * `validateGraph` en couvre davantage, mais il demande un `SiteData` complet —
 * empreintes, destinations, niveaux — que la session du parcours ne porte pas.
 * Lui passer une coquille ferait remonter des anomalies sur des entités
 * absentes, ce qui serait faux. Ces deux cas-ci se jugent sur les seules
 * arêtes, et ce sont ceux que l'éditeur refuse déjà à la saisie : les revoir
 * ici prouve que la validation regarde bien ce qui a été écrit.
 */
function structuralFindings(graph: SessionGraph): readonly Finding[] {
  const findings: Finding[] = [];
  for (const edge of graph.edges) {
    if (edge.from_node_id === edge.to_node_id) {
      findings.push({
        code: 'GRAPH.EDGE_SELF_LOOP',
        severity: 'blocking',
        entity: { kind: 'edge', id: edge.id },
        params: { node_id: edge.from_node_id },
        ruleRef: null,
      });
    }
  }

  const linked = new Set<string>();
  for (const edge of graph.edges) {
    linked.add(edge.from_node_id);
    linked.add(edge.to_node_id);
  }
  for (const node of graph.nodes) {
    if (linked.has(node.id)) continue;
    findings.push({
      code: 'GRAPH.NODE_ORPHAN',
      severity: 'blocking',
      entity: { kind: 'node', id: node.id },
      params: { kind: node.kind },
      ruleRef: null,
    });
  }
  return findings;
}
