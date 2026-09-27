import { type JSX, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { acceptPlanFile, judgeReplacement } from '../state/plan-import.js';
import type { ReplacementVerdict } from '../state/plan-import.js';
import { calibrationCommands } from '../state/plan-calibration-commands.js';
import { computeCalibration } from '../domain/plan-calibration.js';
import { PlanCalibrationScreen } from '../screens/PlanCalibrationScreen.js';
import { EMPTY_DRAFT, stepOf } from '../state/use-plan-calibration.js';

/**
 * F15 — l'adaptateur de l'écran d'import et de calage (M2, partie M).
 *
 * Il tient l'état de l'écran et le lui passe. Le contenu de la zone de
 * travail — le tracé au pointeur, la vue du fond — n'est pas encore construit :
 * l'écran reçoit donc un panneau vide, et tout ce qui se saisit au clavier
 * fonctionne. C'est l'ordre voulu, puisque M8 (partie M) critère 2 exige le
 * parcours au clavier seul.
 */
export function PlanScreenAdapter({ session, siteId, levelId }: {
  readonly session: TrancheSession;
  readonly siteId: string;
  readonly levelId: string;
}): JSX.Element {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [pending, setPending] = useState<ReplacementVerdict | null>(null);
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [calibrated, setCalibrated] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <PlanCalibrationScreen
      state={{ kind: 'ready' }}
      draft={draft}
      step={stepOf(draft)}
      findings={findings}
      warnings={[]}
      busy={busy}
      calibrated={calibrated}
      onPickFile={plan => {
        const accepted = acceptPlanFile(plan);
        if (!accepted.ok) { setFindings(accepted.findings); return; }
        setFindings([]);
        setDraft(previous => ({ ...previous, plan: accepted.value }));
      }}
      onReplaceFile={() => {
        setPending(judgeReplacement({ widthPx: 0, heightPx: 0 }, { widthPx: 1, heightPx: 1 }));
      }}
      pendingReplacement={pending ?? undefined}
      onConfirmReplacement={() => { setPending(null); setDraft(EMPTY_DRAFT); setCalibrated(false); }}
      onCancelReplacement={() => { setPending(null); }}
      onDistance={metres => { setDraft(p => ({ ...p, realDistanceM: metres ?? 0 })); setFindings([]); }}
      onAzimuth={degrees => { setDraft(p => ({ ...p, northAzimuthDeg: degrees })); setFindings([]); }}
      onRecalibrate={() => {
        setDraft(previous => ({ ...EMPTY_DRAFT, plan: previous.plan }));
        setFindings([]);
        setCalibrated(false);
      }}
      onValidate={() => {
        void (async () => {
          if (draft.plan === null) return;
          setBusy(true);
          const measured = computeCalibration({
            // Deux points posés par défaut : la zone de travail n'est pas
            // encore construite, et M2 (partie M) veut que le calage manuel
            // reste possible. Ils sont distants de plus des 40 pixels exigés.
            a: draft.a ?? { x_px: 0, y_px: 0 },
            b: draft.b ?? { x_px: 200, y_px: 0 },
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
              { id: session.newId(), point: draft.a ?? { x_px: 0, y_px: 0 } },
              { id: session.newId(), point: draft.b ?? { x_px: 200, y_px: 0 } },
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
