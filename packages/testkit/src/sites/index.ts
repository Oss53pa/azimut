import type { SiteData } from '@azimut/core-model';
import { refMinimal } from './ref-minimal.js';
import { refBroken } from './ref-broken.js';
import { refAdversarial } from './ref-adversarial.js';
import { refMultilevel } from './ref-multilevel.js';
import { refRetail } from './ref-retail.js';
import { refHealth } from './ref-health.js';
import { refTransit } from './ref-transit.js';
import { refCampus } from './ref-campus.js';

export { refMinimal } from './ref-minimal.js';
export { refBroken } from './ref-broken.js';
export { refAdversarial } from './ref-adversarial.js';
export { refMultilevel } from './ref-multilevel.js';
export { refRetail } from './ref-retail.js';
export { refHealth } from './ref-health.js';
export { refTransit } from './ref-transit.js';
export { refCampus } from './ref-campus.js';

export const allReferenceSites: ReadonlyMap<string, SiteData> = new Map([
  ['ref-minimal', refMinimal],
  ['ref-broken', refBroken],
  ['ref-adversarial', refAdversarial],
  ['ref-multilevel', refMultilevel],
  ['ref-retail', refRetail],
  ['ref-health', refHealth],
  ['ref-transit', refTransit],
  ['ref-campus', refCampus],
]);
