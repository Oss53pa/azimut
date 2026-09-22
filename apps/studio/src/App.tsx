import { type JSX } from 'react';
import { TrancheRouter } from './app/TrancheRouter.js';

/**
 * F15 — `app/` porte la composition des écrans et le routage.
 *
 * Les cinq écrans de la tranche M (partie M) vivent à leurs chemins ; tout
 * autre chemin retombe sur l'atelier existant.
 */
export function App(): JSX.Element {
  return <TrancheRouter />;
}
