import type { SiteData, Finding } from '@azimut/core-model';
import { INSTANCE_SLOT_KIND, faceTemplate, fitsSlot } from '@azimut/core-model';

/**
 * A5.6 / D8.3 — un bloc saisi sur une face remplit l'emplacement du gabarit
 * de même indice et de même nature (décision du 26/09/2026). Un bloc qui n'en
 * trouve pas n'est pas rendu ; ce contrôle le dit, bloquant, pour qu'un texte
 * saisi ne manque pas en silence au panneau posé.
 *
 * Une face dont le gabarit n'est pas connu n'est pas jugée ici : le tableau
 * des messages signale déjà la face sans gabarit (WAYFIND.FACE_TEMPLATE_MISSING).
 */
export function checkInstanceBlocks(site: SiteData): Finding[] {
  const findings: Finding[] = [];
  const supports = new Map(site.supports.map(s => [s.id, s]));
  const faces = new Map(site.support_faces.map(f => [f.id, f]));
  const blocks = [...site.content_blocks].sort((a, b) => a.id.localeCompare(b.id));

  for (const block of blocks) {
    if (INSTANCE_SLOT_KIND[block.kind] === undefined) continue;
    const face = faces.get(block.face_id);
    const support = face === undefined ? undefined : supports.get(face.support_id);
    if (face === undefined || support === undefined) continue;
    const template = faceTemplate(site, support, face.face_index);
    if (template === null || fitsSlot(template, block)) continue;
    findings.push({
      code: 'LAYOUT.INSTANCE_BLOCK_NO_SLOT',
      severity: 'blocking',
      entity: { kind: 'support', id: support.id },
      params: { face_index: face.face_index, block_index: block.block_index, kind: block.kind, template_id: template.id },
      ruleRef: 'D8.3',
    });
  }
  return findings;
}
