import { type JSX } from 'react';
import type { ViewId } from '../views.js';
import { ModuleOutlineView } from './ModuleOutlineView.js';

type KioskAppViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

/**
 * Module 13 — bornes et appli. Le paquet de borne et son exécutable existent
 * hors du studio ; les quatre écrans de la maquette (borne portrait, borne
 * paysage, téléphone, gestion) n'en ont aucun ici.
 */
export function KioskAppView({ onNavigate }: KioskAppViewProps): JSX.Element {
  return (
    <ModuleOutlineView
      moduleNumber="13"
      available={[
        { labelKey: 'nav.item.destinations', noteKey: 'kioskapp.available.destinations', view: 'destinations' },
        { labelKey: 'nav.item.floorplans', noteKey: 'kioskapp.available.floorplans', view: 'floor-plans' },
      ]}
      planned={[
        'kioskapp.planned.portrait',
        'kioskapp.planned.landscape',
        'kioskapp.planned.phone',
        'kioskapp.planned.fleet',
      ]}
      noteKey="kioskapp.note"
      onNavigate={onNavigate}
    />
  );
}
