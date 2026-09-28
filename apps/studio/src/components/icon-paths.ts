/**
 * Les icônes de la coquille, reprises de la maquette « logiciel autonome v2 ».
 *
 * Des traits sur une grille de 24, sans couleur propre : le trait prend
 * `currentColor`, l'icône suit donc le texte qu'elle accompagne et ne porte
 * jamais de valeur (A2.4, M7.10 de la partie M). Aucune icône n'est un caractère : une icône
 * en caractère change avec la police, celle-ci non.
 */
export const ICON_PATHS = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9v11h14V9', 'M10 20v-6h4v6'],
  layers: ['M12 3 2.5 8 12 13l9.5-5z', 'm2.5 12.5 9.5 5 9.5-5', 'm2.5 16.5 9.5 5 9.5-5'],
  signpost: ['M12 2v20', 'M5 5h11l3 3-3 3H5z', 'M19 13H8l-3 3 3 3h11z'],
  route: [
    'M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16',
    'M4 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M16 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ],
  sign: [
    'M4.5 3.5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 13V5a1.5 1.5 0 0 1 1.5-1.5z',
    'M12 14.5V21', 'M8.5 21h7', 'M7 9h8', 'm13 6.5 2.5 2.5-2.5 2.5',
  ],
  pen: [
    'm12 19 7-7 3 3-7 7z', 'm18 13-1.5-7.5L2 2l3.5 14.5L13 18z', 'm2 2 7.6 7.6',
    'M9 11a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ],
  helmet: ['M2.5 18h19', 'M4.5 18a7.5 7.5 0 0 1 15 0', 'M10 11V6.5a2 2 0 0 1 4 0V11', 'M3 18v2h18v-2'],
  wallet: [
    'M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    'M3 10h18', 'M6 6V4.5h12V6',
  ],
  wrench: [
    'M15 3.5a5 5 0 0 0-4.6 6.9L3.5 17.3a2.1 2.1 0 0 0 3 3l6.9-6.9A5 5 0 0 0 20.5 9l-3 3-3-.5-.5-3 3-3a5 5 0 0 0-2-2z',
  ],
  store: [
    'M3.5 9 5 4h14l1.5 5',
    'M3.5 9h17a3 3 0 0 1-5.7 1.3A3 3 0 0 1 12 12a3 3 0 0 1-2.8-1.7A3 3 0 0 1 3.5 9z',
    'M5 12v8h14v-8', 'M10 20v-5h4v5',
  ],
  megaphone: ['M3 10v4h3l8 4.5v-13L6 10z', 'M17.5 9a4 4 0 0 1 0 6', 'm6 14 1.5 6H10l-1-5'],
  kiosk: [
    'M8.5 2.5h7A1.5 1.5 0 0 1 17 4v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17V4a1.5 1.5 0 0 1 1.5-1.5z',
    'M10 15.5h4', 'M12 18.5V21.5', 'M8.5 21.5h7',
  ],
  file: ['M6 2.5h8l5 5v14H6z', 'M14 2.5v5h5', 'M9 13h7', 'M9 17h5'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  search: ['M4 11a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'm20 20-4-4'],
  chev: ['m9 6 6 6-6 6'],
  chevD: ['m6 9 6 6 6-6'],
  collapse: [
    'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M9 4v16', 'm16 10-2 2 2 2',
  ],
  expand: [
    'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M9 4v16', 'm14 10 2 2-2 2',
  ],
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** L'icône de chaque module, par son numéro de partie H. */
export const MODULE_ICONS: Readonly<Record<string, IconName>> = {
  '01': 'layers',
  '02': 'signpost',
  '03': 'route',
  '04': 'sign',
  '05': 'megaphone',
  '06': 'store',
  '07': 'helmet',
  '08': 'wrench',
  '09': 'wallet',
  '10': 'grid',
  '11': 'search',
  '12': 'pen',
  '13': 'kiosk',
  '14': 'file',
};
