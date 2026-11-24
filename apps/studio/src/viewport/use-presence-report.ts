import { useContext, useEffect } from 'react';
import { PresencePublishContext } from '../context/presence.js';
import type { SelectionRef } from '../state/presence.js';
import type { ViewState, Viewport } from './view-transform.js';
import { zoneOfView } from './presence-zone.js';

/**
 * S6.7c — publie ce que l'écran sélectionne et ce qu'il montre. La session
 * décide quand l'annoncer : ce crochet ne fait que dire ce qui a changé.
 */
export function usePresenceReport(
  selection: readonly SelectionRef[],
  view: ViewState,
  viewport: Viewport,
): void {
  const publish = useContext(PresencePublishContext);
  // La clé dit le contenu : un tableau neuf de même contenu ne republie pas.
  const key = JSON.stringify(selection);
  const zone = zoneOfView(view, viewport);
  const zoneKey = JSON.stringify(zone);
  useEffect(() => {
    publish({ selection: JSON.parse(key) as SelectionRef[], zone: JSON.parse(zoneKey) as ReturnType<typeof zoneOfView> });
  }, [publish, key, zoneKey]);
}
