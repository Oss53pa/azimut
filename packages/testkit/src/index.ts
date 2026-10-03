export {
  allReferenceSites,
  refMinimal,
  refBroken,
  refAdversarial,
  refMultilevel,
  refRetail,
} from './sites/index.js';
export { siteChecksum, stableChecksum } from './checksum.js';
export { compareSvg, assertSvgEqual } from './svg-compare.js';
export type { SvgDiff } from './svg-compare.js';
