import { type JSX, useCallback, useMemo, useState } from 'react';
import { useTrancheSession } from './useTrancheSession.js';
import { loadSiteSession } from './site-session-loader.js';
import { appRepository } from '../data/index.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { appSink } from '../state/app-sink.js';
import { rowsOf } from '../state/session-store.js';
import { readSchedule, scheduleVersions } from '../state/message-schedule-read.js';
import {
  NO_FILTERS, applyFilters, buildRows, groupRows,
} from '../state/message-schedule-rows.js';
import type { Grouping, ScheduleFilters } from '../state/message-schedule-rows.js';
import { NO_SELECTION, applyAction } from '../state/message-table-selection.js';
import type { TableSelection } from '../state/message-table-selection.js';
import { can } from '../state/message-schedule-permissions.js';
import type { ScheduleActor } from '../state/message-schedule-permissions.js';
import { diffSchedules, triggersFrom } from '@azimut/engine-graph';
import type { ScheduleState } from '@azimut/engine-graph';
import { MessageTableScreen } from '../screens/MessageTableScreen.js';
import { useI18n } from '../i18n/useI18n.js';
import { ResumeSessionDialog } from '../screens/ResumeSessionDialog.js';
import type { ScreenState } from '../components/ui/index.js';
import { permissionOfTrigger } from '../state/message-schedule-permissions.js';
import { codePointCompare } from '@azimut/core-model';
import type { Finding } from '@azimut/core-model';
import { transitionCommands } from '../state/message-schedule-transitions.js';
import {
  graphValidatedForSite, rulesPackBoundIn, submissionConditions,
} from '../state/schedule-submission.js';
import { AnnotationPanel } from '../screens/message-table/AnnotationPanel.js';
import {
  annotateCommands, annotationsOn, openAnnotationIdsOn, readAnnotations, replyCommand, setStateCommand,
} from '../state/review-annotation.js';

/**
 * Partie R — le branchement de l'écran du tableau des messages.
 *
 * L'écran est site et non niveau : R2 lui donne `/sites/:siteId/wayfinding/
 * messages`, et il appartient à la famille Registre, non à l'atelier. Il ne
 * partage donc pas la session de travail des quatre écrans de l'atelier au
 * sens du parcours de M8 ; il lit le même magasin, ce qui suffit à lui montrer
 * ce que le chemin d'écriture y a posé.
 *
 * Tant qu'aucune version n'est enregistrée, l'écran est dans l'état vide de
 * R16 : « Invitation à générer, avec les prérequis visibles. Jamais un tableau
 * vide présenté comme un résultat. » C'est le comportement attendu et non un
 * manque : la génération relève de l'autre moitié de l'écran.
 */
export function MessageTableAdapter({ siteId, actor }: {
  readonly siteId: string;
  /** R2 (partie R) — le rôle qui consulte. */
  readonly actor: ScheduleActor;
}): JSX.Element {
  // Même émetteur que l'atelier : réel si le dépôt est configuré, local sinon.
  const remote = useMemo(() => appSink() ?? undefined, []);
  // R12 — ce que le dépôt porte du site et de son tableau, comme l'atelier.
  const repository = useMemo(() => appRepository(), []);
  const load = useCallback(() => loadSiteSession(repository, siteId), [repository, siteId]);
  const session = useTrancheSession(
    { orgId: ORG_OF_SESSION, siteId, levelId: '' }, remote, load);
  const [filters, setFilters] = useState<ScheduleFilters>(NO_FILTERS);
  const [grouping, setGrouping] = useState<Grouping>('support');
  const [selection, setSelection] = useState<TableSelection>(NO_SELECTION);
  // R11 (partie R) — la comparaison, fermée tant qu'on ne la demande pas.
  const [comparing, setComparing] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [referenceVersion, setReferenceVersion] = useState<number | null>(null);
  const [comparedVersion, setComparedVersion] = useState<number | null>(null);
  // R12 — les refus de la dernière transition demandée, rendus tels quels.
  const [refusals, setRefusals] = useState<readonly Finding[]>([]);

  const read = useMemo(
    () => readSchedule(session.state, siteId),
    [session.state, siteId],
  );

  // A5.6 — le code lisible d'un support. Vide tant qu'aucun support n'est
  // implanté dans cette session : R5 (partie R) marque alors la cellule au
  // lieu de la laisser muette.
  const supportCodes = useMemo(() => {
    const codes = new Map<string, string>();
    for (const row of rowsOf(session.state, 'support')) {
      const code = row.values['code'];
      if (typeof code === 'string' && code !== '') codes.set(row.id, code);
    }
    return codes;
  }, [session.state]);

  const rows = useMemo(() => {
    if (read === null) return [];
    return buildRows({
      schedule: read.schedule,
      supportCodes,
      exclusions: read.exclusions,
      // Les contrôles du tableau relèvent de `checkMessageSchedule`, que la
      // moitié génération appelle. Rien n'est inventé ici à leur place.
      findings: [],
    });
  }, [read, supportCodes]);

  // R6.3 (partie R) : la recherche plie la casse dans la langue active, déclarée (A9).
  const { lang } = useI18n();
  const filtered = useMemo(() => applyFilters(rows, filters, lang), [rows, filters, lang]);

  const groups = useMemo(
    () => groupRows(filtered.rows, grouping, {
      zoneOfSupport: new Map(),
      levelOfSupport: new Map(),
    }),
    [filtered.rows, grouping],
  );

  const visibleIds = groups.flatMap(group => group.rows.map(row => row.line.id));
  const issueIds = filtered.rows
    .filter(row => row.state === 'stale' || row.state === 'blocking')
    .map(row => row.line.id);

  const focusedRow = filtered.rows.find(row => row.line.id === selection.focusedId) ?? null;

  // A5.8 — le paquet de règles du site, lu dans la table de rattachement qui
  // fait foi. Son absence est un bandeau, jamais un blocage : R14 et N2.8
  // disent que le plafond de M02.W9 ne s'applique alors pas et que l'écran le dit.
  const rulesPackBound = rulesPackBoundIn(session.state, siteId);
  // M02.W11 — le dernier passage de validation du site, pour le graphe actuel.
  const graphValidated = useMemo(
    () => graphValidatedForSite(session.state, siteId), [session.state, siteId]);

  const state: ScreenState = read === null ? { kind: 'empty' } : { kind: 'ready' };

  // R4 (partie R) : « Comparer | Au moins deux versions. »
  const versions = scheduleVersions(session.state, siteId);
  const canCompare = versions.length >= 2;

  /**
   * Les deux versions comparées. Par défaut les deux plus hautes, dans le sens
   * que R11 donne : la plus ancienne est la référence, la plus récente celle
   * qu'on lui oppose, de sorte qu'une ligne neuve soit « ajoutée » et non
   * « supprimée ».
   */
  const reference = referenceVersion ?? versions[1] ?? versions[0] ?? 0;
  const compared = comparedVersion ?? versions[0] ?? 0;

  const compare = useMemo(() => {
    if (!comparing) return null;
    if (reference === compared) return null;
    const before = readSchedule(session.state, siteId, reference);
    const after = readSchedule(session.state, siteId, compared);
    if (before === null || after === null) return null;
    return diffSchedules(before.schedule, after.schedule, LANGS);
  }, [comparing, reference, compared, session.state, siteId]);

  const scheduleState: ScheduleState | null = read?.schedule.state ?? null;
  // R16 (partie R), hors ligne : « générer, émettre et approuver
  // indisponibles et dits tels ». Les actions sont retirées et l'écran le dit.
  const actions = !session.state.online ? [] : triggersFrom(scheduleState).filter(trigger => {
    const permission = permissionOfTrigger(trigger);
    return permission !== null && can(actor, permission);
  });

  // R7.4 et J4 — les annotations de révision, relues dans la session. Celles
  // qui restent ouvertes sur les lignes du tableau bloquent l'approbation
  // (R12) : `transitionSchedule` les reçoit par `openAnnotationIds`.
  const annotations = useMemo(() => readAnnotations(session.state.rows), [session.state.rows]);
  const openAnnotationIds = openAnnotationIdsOn(annotations, rows.map(row => row.line.id));
  const canAnnotate = can(actor, 'annotate');
  // R8 — une remarque posée sur la sélection crée une annotation par ligne ;
  // sans sélection, elle vise la ligne ouverte dans le détail.
  const targets = selection.selectedIds.length > 0
    ? [...selection.selectedIds].sort(codePointCompare)
    : focusedRow === null ? [] : [focusedRow.line.id];
  const write = { orgId: ORG_OF_SESSION, siteId, timestamp: session.now() };
  const annotationPanel = focusedRow === null ? null : (
    <AnnotationPanel
      annotations={annotationsOn(annotations, { kind: 'message_line', id: focusedRow.line.id })}
      canAnnotate={canAnnotate}
      targetCount={targets.length}
      online={session.state.online}
      onAnnotate={note => {
        const out = annotateCommands(
          targets.map(id => ({ id: session.newId(), anchor: { kind: 'message_line' as const, id } })),
          note, write,
        );
        if (out.kind !== 'written') return false;
        void session.write(out.commands);
        return true;
      }}
      onReply={(annotationId, body) => {
        const command = replyCommand(annotationId, session.newId(), body, write);
        if (command !== null) void session.write([command]);
      }}
      onSetState={(annotation, next) => {
        const command = setStateCommand(annotation, next, write);
        if (command !== null) void session.write([command]);
      }}
    />
  );

  // E5.4 — l'écran partage le magasin de la session ; il en partage donc la
  // cérémonie de reprise. Adopter l'état local sans le demander parce que cet
  // écran ne l'écrit pas ferait deux comportements là où il n'y en a qu'un.
  const resume = session.pendingResume;

  return (
    <>
    <MessageTableScreen
      state={state}
      schedule={read?.schedule ?? emptySchedule(siteId)}
      groups={groups}
      langs={LANGS}
      filters={filters}
      onFilters={setFilters}
      grouping={grouping}
      onGrouping={setGrouping}
      supportOptions={optionsOf(rows.map(row => row.line.support_id))}
      directionOptions={optionsOf(
        rows.map(row => row.line.direction).filter((d): d is string => d !== null),
      )}
      decisionPointOptions={optionsOf(rows.map(row => row.line.decision_point_id))}
      levelOptions={[1, 2, 3, 4].map(level => ({
        value: String(level),
        label: String(level),
      }))}
      hidden={filtered.hidden}
      selection={selection}
      onAction={action => {
        setSelection(current => applyAction(current, action, { visibleIds, issueIds }));
      }}
      onFocusRow={id => { setSelection(current => ({ ...current, focusedId: id })); }}
      focusedRow={focusedRow}
      profilesAtDecisionPoint={[]}
      onOpenSource={() => { /* R7.3 — la navigation vers l'écran source */ }}
      actions={actions}
      onTrigger={trigger => {
        // R12 — l'émission pour revue. Générer relève de la moitié génération ;
        // approuver et rejeter attendent un approbateur authentifié, et R2 (partie R) les
        // refuse au rôle de la session : ils ne sont jamais offerts ici.
        if (trigger !== 'submit_for_review' || read === null) return;
        const out = transitionCommands(
          'submit_for_review',
          { id: read.scheduleId, schedule: read.schedule },
          submissionConditions(session.state, siteId, read.schedule, openAnnotationIds, LANGS),
          null,
          { orgId: ORG_OF_SESSION, timestamp: session.now(), decisionId: session.newId() },
        );
        if (!out.ok) { setRefusals(out.findings); return; }
        setRefusals([]);
        // `record` et non `write` : R12 ne ramène une version en revue au
        // brouillon que par un rejet motivé. Une annulation le contournerait.
        void session.record(out.value);
      }}
      refusals={refusals}
      canCompare={canCompare}
      onCompare={() => { setComparing(true); }}
      compare={comparing ? {
        versions,
        referenceVersion: reference,
        comparedVersion: compared,
        onReference: setReferenceVersion,
        onCompared: setComparedVersion,
        diff: compare,
        showUnchanged,
        onShowUnchanged: setShowUnchanged,
        supportCodes,
        langs: LANGS,
        onClose: () => { setComparing(false); },
      } : null}
      canExport={can(actor, 'export')}
      onExport={() => { /* R13 — l'export */ }}
      staleCount={rows.filter(row => row.state === 'stale').length}
      blockingCount={rows.filter(row => row.state === 'blocking').length}
      excludedCount={filtered.excluded}
      onRegenerate={() => { /* R12 — régénérer écrit */ }}
      graphValidated={graphValidated}
      rulesPackBound={rulesPackBound}
      onOpenValidation={() => { /* lien vers l'écran de validation */ }}
      unreadableCount={read?.unreadable.length ?? 0}
      online={session.state.online}
      onEmptyAction={() => { /* R12 — générer écrit */ }}
      annotationPanel={annotationPanel}
      openAnnotationCount={openAnnotationIds.length}
    />
    {resume !== null && (
      <ResumeSessionDialog
        rowCount={resume.rows.length}
        queuedCount={resume.queued.length}
        onAccept={session.acceptResume}
        onDiscard={session.discardResume}
      />
    )}
    </>
  );
}

/**
 * L'en-tête que la barre de version affiche quand aucune version n'existe.
 *
 * L'état vide de R16 (partie R) remplace le contenu ; cette valeur n'est
 * jamais lue par l'utilisateur, elle existe pour que la barre reste typée sans
 * être rendue facultative dans l'écran, où R4 la veut toujours présente.
 */
function emptySchedule(siteId: string): {
  site_id: string; version: number; state: ScheduleState;
  generated_at: string; inputs_hash: string; lines: [];
} {
  return {
    site_id: siteId,
    version: 0,
    state: 'draft',
    generated_at: '',
    inputs_hash: '',
    lines: [],
  };
}

function optionsOf(values: readonly string[]): readonly { value: string; label: string }[] {
  return [...new Set(values)]
    .sort((a, b) => codePointCompare(a, b))
    .map(value => ({ value, label: value }));
}

/** D12.1 — les deux langues actives. Le site les portera en donnée (N1.2). */
const LANGS = ['fr', 'en'] as const;

