import { type JSX, useMemo } from 'react';
import { TrancheRouter } from './app/TrancheRouter.js';
import { AuthGate } from './auth/AuthGate.js';
import { appAuthClient } from './auth/auth-config.js';
import { I18nProvider } from './i18n/index.js';
import { langFromLocation } from './app/lang.js';

/**
 * F15 — `app/` porte la composition des écrans et le routage.
 *
 * Les cinq écrans de la tranche M (partie M) vivent à leurs chemins ; tout
 * autre chemin retombe sur l'atelier existant.
 */
export function App(): JSX.Element {
  // AUTH.3 — construit une fois : changer de client en cours de session
  // perdrait la session.
  const auth = useMemo(() => appAuthClient(), []);
  return (
    <I18nProvider defaultLang={langFromLocation(window.location.search)}>
      <AuthGate client={auth}>
        <TrancheRouter />
      </AuthGate>
    </I18nProvider>
  );
}

