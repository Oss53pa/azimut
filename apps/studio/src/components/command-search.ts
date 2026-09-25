/**
 * La recherche « aller à » de la coquille : ce qu'elle indexe et comment elle
 * compare.
 *
 * Elle n'indexe que la carte du produit — modules et écrans — parce que c'est
 * la seule chose que l'application sait nommer partout. Chercher dans les
 * données du site relève du module 11, qui n'a pas de moteur de recherche
 * (`crosscutting.missing.search`) ; la palette ne le simule pas.
 */
import type { ViewId } from '../views.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { PRODUCT_MODULES } from '../product-map.js';

export type CommandKind = 'module' | 'screen';

export type CommandEntry = {
  readonly view: ViewId;
  readonly kind: CommandKind;
  readonly labelKey: UiMessageKey;
  /** Le module qui porte l'écran, ou `null` pour le chrome. */
  readonly moduleNumber: string | null;
  readonly moduleNameKey: UiMessageKey | null;
};

/** Les écrans hors module, cherchables comme les autres. */
const CHROME_ENTRIES: readonly CommandEntry[] = [
  { view: 'dashboard', kind: 'screen', labelKey: 'shell.nav.home', moduleNumber: null, moduleNameKey: null },
  { view: 'product-map', kind: 'screen', labelKey: 'nav.item.productmap', moduleNumber: null, moduleNameKey: null },
];

/** Toutes les destinations, dans l'ordre de la carte du produit. */
export function commandEntries(): readonly CommandEntry[] {
  const out: CommandEntry[] = [...CHROME_ENTRIES];
  for (const module of PRODUCT_MODULES) {
    out.push({
      view: module.entry,
      kind: 'module',
      labelKey: module.nameKey,
      moduleNumber: module.number,
      moduleNameKey: module.nameKey,
    });
    for (const screen of module.screens) {
      out.push({
        view: screen.view,
        kind: 'screen',
        labelKey: screen.labelKey,
        moduleNumber: module.number,
        moduleNameKey: module.nameKey,
      });
    }
  }
  return out;
}

/** Minuscules, sans diacritiques : « Régie » se trouve en tapant « regie ». */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim();
}

/**
 * Filtre les destinations. Chaque mot de la requête doit se retrouver dans le
 * libellé, le nom du module ou son numéro ; l'ordre de la carte est conservé,
 * sauf qu'un libellé qui commence par la requête passe devant.
 */
export function searchCommands(
  entries: readonly CommandEntry[],
  query: string,
  translate: (key: UiMessageKey) => string,
): readonly CommandEntry[] {
  const q = normalize(query);
  if (q === '') return entries;
  const words = q.split(/\s+/);
  const scored: { entry: CommandEntry; rank: number; index: number }[] = [];
  entries.forEach((entry, index) => {
    const label = normalize(translate(entry.labelKey));
    const moduleName = entry.moduleNameKey === null ? '' : normalize(translate(entry.moduleNameKey));
    const haystack = `${label} ${moduleName} ${entry.moduleNumber ?? ''}`;
    if (!words.every(w => haystack.includes(w))) return;
    scored.push({ entry, rank: label.startsWith(q) ? 0 : 1, index });
  });
  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return scored.map(s => s.entry);
}
