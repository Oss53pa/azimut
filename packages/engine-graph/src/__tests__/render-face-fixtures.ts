/**
 * Le décor partagé des essais de `renderFace` (T-2.15) : thème, options de
 * rendu, et une face résolue sur le site de référence multi-niveaux. Réparti
 * entre plusieurs fichiers d'essais pour tenir la limite de 400 lignes (A2.4).
 */
import type { FaceTheme, RenderFaceOptions } from '../render-face.js';
import { resolveFaceContent } from '../resolve-face.js';
import type { ResolvedFace } from '../resolve-face.js';
import { refMultilevel } from '@azimut/testkit';
import type { FaceTemplate, TravelProfile } from '@azimut/core-model';

const theme: FaceTheme = {
  background: 'tok-bg',
  text_primary: 'tok-txt',
  text_secondary: 'tok-sec',
  accent: 'tok-acc',
  border: 'tok-brd',
};

export const opts: RenderFaceOptions = {
  width_mm: 600,
  height_mm: 400,
  theme,
  font_family: 'Helvetica',
};

function getProfile(key: string): TravelProfile {
  const p = refMultilevel.travel_profiles.find((pr) => pr.key === key);
  if (!p) throw new Error(`No profile: ${key}`);
  return p;
}

function getTemplate(id: string): FaceTemplate {
  const t = refMultilevel.face_templates.find((tpl) => tpl.id === id);
  if (!t) throw new Error(`No template: ${id}`);
  return t;
}

export function resolveFace(): ResolvedFace {
  const result = resolveFaceContent(
    refMultilevel,
    getTemplate('ftpl-dir-front'),
    'n-ml-hall',
    getProfile('standard'),
  );
  if (!result.ok) throw new Error('resolve failed');
  return result.value;
}
