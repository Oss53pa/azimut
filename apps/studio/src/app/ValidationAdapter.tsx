import { type JSX, useState } from 'react';
import { computeGraphHash, validateGraph } from '@azimut/engine-graph';
import type { Finding } from '@azimut/core-model';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { graphScopeFromSession } from '../state/session-scope.js';
import { writeGraphValidation } from '../state/graph-validation-commands.js';
import { NEVER_RUN } from '../state/validation-report.js';
import type { ValidationState } from '../state/validation-report.js';
import { ValidationScreen } from '../screens/ValidationScreen.js';

/**
 * M5 (partie M) — « Relancer | Recalcule, affiche la durée réelle, enregistre
 * le passage dans `graph_validation`. »
 *
 * L'enregistrement est ce qui distingue cet écran d'un calcul jetable : la
 * règle M02.W11 lit le dernier passage du site et son empreinte de graphe, et
 * sans trace elle n'avait rien à lire.
 *
 * Le contrôle est celui du moteur, et non une reprise à la main de deux de ses
 * cas. INV-1 ne tolère pas la seconde forme : deux implémentations d'un même
 * contrôle finissent par diverger, et c'est alors l'écran qui décide de ce qui
 * est valide. Le moteur lit ce que `GraphScope` nomme, la session le lui
 * fournit, et ce que la session ne porte pas reste vide plutôt qu'inventé.
 *
 * À part dans un fichier : les quatre adaptateurs d'atelier portaient déjà
 * `workshop-adapters.tsx` au-delà des 400 lignes qu'A2.4 fixe, et celui-ci est
 * le seul de la famille Document.
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
        const { scope, unreadable } = graphScopeFromSession(session.state);
        const findings: Finding[] = [];

        // Une ligne du magasin qui ne se relit pas est un fait, pas un détail
        // de lecture : valider un graphe amputé reviendrait à valider ce que
        // personne n'a saisi.
        for (const id of unreadable) {
          findings.push({
            code: 'EDIT.COMMAND_SHAPE_INVALID',
            severity: 'blocking',
            entity: { kind: 'graph_row', id },
            params: {},
            ruleRef: null,
          });
        }

        // Le parcours de M8 (partie M) ne rattache aucun paquet de règles :
        // aucune anomalie normative n'est donc levée, et l'écran dit ce qu'il
        // a vu, pas ce qu'il aurait vu sous un paquet.
        const outcome = validateGraph(scope);
        findings.push(...(outcome.ok ? outcome.warnings : outcome.findings));

        // D2.2 — un graphe dont l'empreinte est refusée ne s'enregistre pas :
        // un passage sans empreinte ne vaudrait pour aucun graphe (M02.W11).
        const graphHash = computeGraphHash(scope.graph);
        if (!graphHash.ok) findings.push(...graphHash.findings);

        const ranAt = session.now();
        setValidation({
          kind: 'ran',
          findings,
          ranAt,
          durationMs: Math.round(performance.now() - started),
        });

        if (!graphHash.ok) return;
        const command = writeGraphValidation(findings, {
          orgId: ORG_OF_SESSION,
          siteId,
          id: session.newId(),
          timestamp: ranAt,
          graphHash: graphHash.value,
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
