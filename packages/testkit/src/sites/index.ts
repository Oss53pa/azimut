import type { SiteData } from '@azimut/core-model';
import { refMinimal } from './ref-minimal.js';
import { refBroken } from './ref-broken.js';
import { refAdversarial } from './ref-adversarial.js';
import { refMultilevel } from './ref-multilevel.js';

export { refMinimal } from './ref-minimal.js';
export { refBroken } from './ref-broken.js';
export { refAdversarial } from './ref-adversarial.js';
export { refMultilevel } from './ref-multilevel.js';

export const allReferenceSites: ReadonlyMap<string, SiteData> = new Map([
  ['ref-minimal', refMinimal],
  ['ref-broken', refBroken],
  ['ref-adversarial', refAdversarial],
  ['ref-multilevel', refMultilevel],
]);
