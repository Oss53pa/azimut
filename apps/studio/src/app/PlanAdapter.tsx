import { type JSX, useRef, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { acceptPlanFile, unreadablePlanInspection } from '../state/plan-import.js';
import type { PlanFile } from '../state/plan-import.js';
import { inspectPlanContent } from '../state/plan-content.js';
import type { PlanInspection } from '../state/plan-content.js';
import { calibrationCommands } from '../state/plan-calibration-commands.js';
import { computeCalibration } from '../domain/plan-calibration.js';
import type { PlanPoint } from '../domain/plan-calibration.js';
import { PlanCalibrationScreen } from '../screens/PlanCalibrationScreen.js';
import type { PartialPoint } from '../screens/PlanCalibrationScreen.js';
import { EMPTY_DRAFT, stepOf } from '../state/plan-calibration-steps.js';
import { judgeReplacement } from '../state/plan-import.js';
import type { ReplacementVerdict } from '../state/plan-import.js';

/**
 * M2 (partie M) — l'adaptateur de l'import et du calage.
 *
 * F15 sépare les adaptateurs du routeur : il décide quel écran paraît, ils
 * décident ce que chaque écran reçoit. Un fichier par écran, chacun tenant
 * l'état du sien.
 *
 * Le contenu de la zone de travail — le tracé au pointeur, la vue du fond —
 * n'est pas encore construit : les écrans reçoivent un panneau vide, et tout
 * ce qui se saisit au clavier fonctionne. C'est l'ordre voulu, puisque M8
 * (partie M) critère 2 exige le parcours au clavier seul.
 */
export function PlanScreenAdapter({ session, siteId, levelId }: {
  readonly session: TrancheSession;
  readonly siteId: string;
  readonly levelId: string;
}): JSX.Element {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // Les deux points sont tenus coordonnée par coordonnée : une abscisse saisie
  // avant son ordonnée doit rester affichée, et ne fait pas encore un point.
  const [pointA, setPointA] = useState<PartialPoint>(NO_POINT);
  const [pointB, setPointB] = useState<PartialPoint>(NO_POINT);
  const [pending, setPending] = useState<ReplacementVerdict | null>(null);
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  // M2 (partie M), versions 27 et 28 : le fond se juge sur son contenu, lu
  // une fois au dépôt. Le fichier et ce que son contenu dit de lui restent
  // tenus, pour rejuger sans relire quand la page change. Le jeton écarte la
  // lecture d'un fichier remplacé entre-temps, dont le résultat arriverait
  // après celui du suivant.
  const [warnings, setWarnings] = useState<readonly Finding[]>([]);
  const [picked, setPicked] = useState<{ file: PlanFile; inspection: PlanInspection } | null>(null);
  const contentReading = useRef(0);
  const [calibrated, setCalibrated] = useState(false);
  const [busy, setBusy] = useState(false);

  function judge(file: PlanFile, inspection: PlanInspection): void {
    const accepted = acceptPlanFile(file, inspection);
    if (!accepted.ok) {
      setFindings(accepted.findings);
      setWarnings([]);
      setDraft(previous => ({ ...previous, plan: null }));
      return;
    }
    setFindings([]);
    setWarnings(accepted.warnings);
    setDraft(previous => ({ ...previous, plan: accepted.value }));
  }

  return (
    <PlanCalibrationScreen
      state={{ kind: 'ready' }}
      draft={draft}
      step={stepOf(draft)}
      findings={findings}
      warnings={warnings}
      busy={busy}
      calibrated={calibrated}
      onPickFile={(plan, content) => {
        const reading = ++contentReading.current;
        setWarnings([]);
        setPicked(null);
        setDraft(previous => ({ ...previous, plan: null }));
        void content.arrayBuffer()
          .then(buffer => inspectPlanContent(new Uint8Array(buffer)))
          .catch(() => unreadablePlanInspection())
          .then(inspection => {
            if (reading !== contentReading.current) return;
            setPicked({ file: plan, inspection });
            judge(plan, inspection);
          });
      }}
      pageCount={picked?.inspection.pageCount ?? null}
      page={picked?.file.page ?? null}
      onPage={page => {
        if (picked === null) return;
        const file = { ...picked.file, page };
        setPicked({ file, inspection: picked.inspection });
        judge(file, picked.inspection);
      }}
      onReplaceFile={() => {
        setPending(judgeReplacement({ widthPx: 0, heightPx: 0 }, { widthPx: 1, heightPx: 1 }));
      }}
      pendingReplacement={pending ?? undefined}
      onConfirmReplacement={() => {
        contentReading.current += 1;
        setWarnings([]);
        setPicked(null);
        setPending(null);
        setDraft(EMPTY_DRAFT);
        setPointA(NO_POINT);
        setPointB(NO_POINT);
        setCalibrated(false);
      }}
      onCancelReplacement={() => { setPending(null); }}
      pointA={pointA}
      pointB={pointB}
      onPointA={(coordinate, value) => {
        setPointA(previous => {
          const next = { ...previous, [coordinate]: value };
          setDraft(p => ({ ...p, a: planPoint(next) }));
          return next;
        });
        setFindings([]);
      }}
      onPointB={(coordinate, value) => {
        setPointB(previous => {
          const next = { ...previous, [coordinate]: value };
          setDraft(p => ({ ...p, b: planPoint(next) }));
          return next;
        });
        setFindings([]);
      }}
      onDistance={metres => { setDraft(p => ({ ...p, realDistanceM: metres ?? 0 })); setFindings([]); }}
      onAzimuth={degrees => { setDraft(p => ({ ...p, northAzimuthDeg: degrees })); setFindings([]); }}
      onRecalibrate={() => {
        // M2 (partie M) : « Recaler | Reprend à l'étape 2, conserve le fond. »
        // Les points saisis partent avec l'étape qu'ils servaient.
        setDraft(previous => ({ ...EMPTY_DRAFT, plan: previous.plan }));
        setPointA(NO_POINT);
        setPointB(NO_POINT);
        setFindings([]);
        setCalibrated(false);
      }}
      onValidate={() => {
        void (async () => {
          if (draft.plan === null) return;
          setBusy(true);
          // Les deux points sont ceux que l'opérateur a saisis, et rien
          // d'autre. L'écran en posait deux d'office quand ils manquaient —
          // c'était écrire en base un calage que personne n'avait fait, et
          // `CALIB.POINT_REQUIRED` existe précisément pour le refuser.
          const measured = computeCalibration({
            a: draft.a,
            b: draft.b,
            real_distance_m: draft.realDistanceM,
            north_azimuth_deg: draft.northAzimuthDeg,
          });
          if (!measured.ok) { setFindings(measured.findings); setBusy(false); return; }

          const commands = calibrationCommands(draft.plan, measured.value, {
            site: {}, proposed: { x_m: 0, y_m: 0 },
          }, {
            orgId: ORG_OF_SESSION,
            siteId,
            levelId,
            planSourceId: session.newId(),
            calibrationId: session.newId(),
            storagePath: `plans/${siteId}/${levelId}`,
            // A5.2 — les deux points de la mesure, dans l'ordre de pose.
            points: [
              ...(draft.a !== null ? [{ id: session.newId(), point: draft.a }] : []),
              ...(draft.b !== null ? [{ id: session.newId(), point: draft.b }] : []),
            ],
            referenceDistanceM: draft.realDistanceM,
            timestamp: session.now(),
          });
          if (!commands.ok) { setFindings(commands.findings); setBusy(false); return; }

          await session.write(commands.value);
          setFindings([]);
          setCalibrated(true);
          setBusy(false);
        })();
      }}
    />
  );
}

const NO_POINT: PartialPoint = { x_px: null, y_px: null };

/**
 * Un point de calage à partir de deux coordonnées saisies séparément.
 *
 * Tant qu'une des deux manque, le point n'existe pas : le compléter par un
 * zéro poserait un point sur le bord de l'image sans que personne l'ait
 * demandé, et le calage en dépend au pixel près.
 */
function planPoint(partial: PartialPoint): PlanPoint | null {
  const { x_px, y_px } = partial;
  return x_px === null || y_px === null ? null : { x_px, y_px };
}
