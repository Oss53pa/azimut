/**
 * M2 (partie M), version 27 — un DXF est accepté comme fond de plan ; qu'il
 * porte un contenu vectoriel exploitable se juge sur son contenu.
 *
 * Ce module compte les entités géométriques d'un DXF texte : celles de la
 * section `ENTITIES`, et, si cette section insère des blocs (`INSERT`), celles
 * de la section `BLOCKS`. Un DXF qui ne porte qu'une image (`IMAGE`), du texte
 * ou rien n'a pas de tracé.
 *
 * Le DXF binaire n'est pas lu : il est signalé comme tel, jamais supposé vide
 * ni supposé vectoriel.
 */

export type DxfGeometry =
  | { readonly binary: true }
  | { readonly binary: false; readonly geometric: number };

const BINARY_SENTINEL = 'AutoCAD Binary DXF';

const GEOMETRIC = new Set([
  'LINE', 'LWPOLYLINE', 'POLYLINE', 'ARC', 'CIRCLE', 'ELLIPSE', 'SPLINE',
  'SOLID', '3DFACE', 'HATCH',
]);

export function countDxfGeometry(bytes: Uint8Array): DxfGeometry {
  const text = new TextDecoder('latin1').decode(bytes);
  if (text.startsWith(BINARY_SENTINEL)) return { binary: true };

  const lines = text.split(/\r\n|\n|\r/).map(line => line.trim());
  let section: string | null = null;
  let entities = 0;
  let inserts = 0;
  let blocks = 0;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i];
    const value = lines[i + 1] ?? '';
    if (code === '0' && value === 'SECTION') {
      section = lines[i + 2] === '2' ? (lines[i + 3] ?? null) : null;
      i += 2;
      continue;
    }
    if (code === '0' && value === 'ENDSEC') { section = null; continue; }
    if (code !== '0') continue;
    if (section === 'ENTITIES') {
      if (GEOMETRIC.has(value)) entities += 1;
      else if (value === 'INSERT') inserts += 1;
    } else if (section === 'BLOCKS' && GEOMETRIC.has(value)) {
      blocks += 1;
    }
  }
  return { binary: false, geometric: entities + (inserts > 0 ? blocks : 0) };
}

/** Un DXF texte commence par la paire `0` / `SECTION`, éventuellement après des commentaires `999`. */
export function looksLikeTextDxf(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const lines = head.split(/\r\n|\n|\r/).map(line => line.trim());
  for (let i = 0; i + 1 < lines.length; i += 2) {
    if (lines[i] === '999') continue;
    return lines[i] === '0' && lines[i + 1] === 'SECTION';
  }
  return false;
}
