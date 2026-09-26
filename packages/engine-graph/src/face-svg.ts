/**
 * Primitives SVG partagées par le rendu d'une face : le thème, l'échappement
 * et le choix d'une variante de langue. Sorties de `render-face.ts` pour tenir
 * la limite de taille des fichiers ; le rendu produit est inchangé (INV-4).
 */

export type FaceTheme = {
  readonly background: string;
  readonly text_primary: string;
  readonly text_secondary: string;
  readonly accent: string;
  readonly border: string;
};

/**
 * D12 — pick the destination name for the active language, falling back
 * deterministically to the first available variant when the language is
 * absent (a missing variant is reported separately as LAYOUT.LANG_VARIANT_MISSING).
 */
export function pickName(
  names: Readonly<Record<string, string>>,
  lang: string | undefined,
): string {
  if (lang !== undefined && names[lang] !== undefined) return names[lang];
  const firstKey = Object.keys(names)[0];
  return firstKey !== undefined ? (names[firstKey] as string) : '';
}

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
