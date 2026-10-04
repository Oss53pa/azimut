import { useEffect, useMemo, useState } from 'react';
import { isDisplayableImage, levelPlan } from '../domain/plan-placement.js';
import type { PlanBackground } from '../screens/InkWorkZone.js';
import type { UiMessageKey } from '../i18n/messages.js';
import type { TrancheSession } from './useTrancheSession.js';

/**
 * J1.4 (partie J) — le fond du décalque d'un niveau.
 *
 * Le plan calé du niveau, lu dans les lignes de la session ; son image, gardée
 * par la session depuis le calage. L'image n'est posée que si c'est une image
 * (PNG, JPEG) : le rendu des PDF n'est pas encore construit. Quand il n'y a pas
 * de fond, la raison est rendue, pour que l'écran la dise au lieu de montrer
 * une zone vide sans explication.
 */
export type PlanBackgroundState = {
  readonly background: PlanBackground | null;
  readonly notice: UiMessageKey | null;
};

export function usePlanBackground(session: TrancheSession, levelId: string): PlanBackgroundState {
  const plan = useMemo(() => levelPlan(session.state.rows, levelId), [session.state.rows, levelId]);
  const image = plan === null ? undefined : session.planImages.get(plan.planSourceId);
  const displayable = plan !== null && isDisplayableImage(plan.mediaType) && image !== undefined;
  const [loaded, setLoaded] = useState<PlanBackground | null>(null);

  useEffect(() => {
    setLoaded(null);
    if (!displayable || plan === null || image === undefined) return undefined;
    const href = URL.createObjectURL(new Blob([new Uint8Array(image.bytes)], { type: image.mediaType }));
    let alive = true;
    const probe = new Image();
    probe.onload = () => {
      if (!alive) return;
      setLoaded({ href, width_px: probe.naturalWidth, height_px: probe.naturalHeight, placement: plan.placement });
    };
    probe.src = href;
    return () => { alive = false; URL.revokeObjectURL(href); };
  }, [displayable, plan, image]);

  if (plan === null) return { background: null, notice: 'ink.background.none' };
  if (!isDisplayableImage(plan.mediaType)) return { background: null, notice: 'ink.background.not_image' };
  if (image === undefined) return { background: null, notice: 'ink.background.not_kept' };
  return { background: loaded, notice: null };
}
