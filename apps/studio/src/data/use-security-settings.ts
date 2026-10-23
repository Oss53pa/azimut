import { useEffect, useState } from 'react';
import { appPostgrestConfig } from './config.js';
import { loadSecuritySettings } from './security-settings.js';
import type { SecuritySettings } from './security-settings.js';
import { REFERENCE_SECURITY_SETTINGS } from './reference-security-settings.js';
import { orgOfSession } from '../app/session-identity.js';

/**
 * Les seuils en vigueur pour l'organisation de la session, ou `null` tant
 * qu'ils ne sont pas lus. Un écran qui en dépend refuse d'agir sans eux :
 * l'absence de seuil ne vaut jamais « sans limite ».
 */
export function useSecuritySettings(): SecuritySettings | null {
  const config = appPostgrestConfig();
  const [settings, setSettings] = useState<SecuritySettings | null>(
    () => (config === null ? REFERENCE_SECURITY_SETTINGS : null));
  const org = orgOfSession();

  useEffect(() => {
    const current = appPostgrestConfig();
    if (current === null) return;
    let live = true;
    setSettings(null);
    loadSecuritySettings(current, org)
      .then(read => { if (live) setSettings(read); })
      .catch(() => { if (live) setSettings(null); });
    return () => { live = false; };
  }, [org]);

  return settings;
}
