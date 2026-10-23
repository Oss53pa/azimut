import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { brandTokens } from '@azimut/design-tokens';
import '@azimut/design-tokens/studio-theme.css';
import './theme.css';

/*
 * Couleur de la barre du navigateur, celle du kit de marque Atlas Studio.
 * Posée ici plutôt qu'écrite dans `index.html` : aucune couleur ne s'écrit
 * hors du fichier de jetons (A2.4, A11.1).
 */
const themeColor = document.createElement('meta');
themeColor.name = 'theme-color';
themeColor.content = brandTokens['brand-ink'];
document.head.append(themeColor);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
