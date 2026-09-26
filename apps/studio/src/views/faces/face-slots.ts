/**
 * A5.6 — les emplacements de face du site : pour chaque support, autant de
 * faces que sa typologie en prévoit (la face 0 seule sans typologie), chacune
 * déclarée en base ou non. Une face déclarée au-delà du nombre prévu reste
 * listée, marquée hors typologie, pour ne pas disparaître en silence.
 */
import { supportFaceCount, type SiteData, type Support, type SupportFace } from '@azimut/core-model';

export type FaceSlot = {
  readonly support: Support;
  readonly faceIndex: number;
  readonly face: SupportFace | undefined;
  /** Les blocs de contenu de la face déclarée. */
  readonly blocks: number;
  /** Face déclarée à un indice que la typologie ne prévoit pas. */
  readonly outOfRange: boolean;
};

export function slotKey(slot: Pick<FaceSlot, 'support' | 'faceIndex'>): string {
  return `${slot.support.id}:${String(slot.faceIndex)}`;
}

export function faceSlots(site: SiteData): readonly FaceSlot[] {
  const blocksByFace = new Map<string, number>();
  for (const b of site.content_blocks) blocksByFace.set(b.face_id, (blocksByFace.get(b.face_id) ?? 0) + 1);

  return [...site.supports]
    .sort((a, b) => (a.code ?? a.id).localeCompare(b.code ?? b.id) || a.id.localeCompare(b.id))
    .flatMap(support => {
      const count = supportFaceCount(site, support.id);
      const declared = site.support_faces.filter(f => f.support_id === support.id);
      const indices = new Set([...Array.from({ length: count }, (_, i) => i), ...declared.map(f => f.face_index)]);
      return [...indices].sort((a, b) => a - b).map((faceIndex): FaceSlot => {
        const face = declared.find(f => f.face_index === faceIndex);
        return {
          support, faceIndex, face,
          blocks: face === undefined ? 0 : (blocksByFace.get(face.id) ?? 0),
          outOfRange: faceIndex >= count,
        };
      });
    });
}
