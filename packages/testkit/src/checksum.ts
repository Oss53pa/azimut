import { createHash } from 'node:crypto';

export function stableChecksum(value: unknown): string {
  const json = JSON.stringify(value, Object.keys(
    value as Record<string, unknown>,
  ).sort());
  return createHash('sha256').update(json).digest('hex');
}

export function siteChecksum(site: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(site))
    .digest('hex');
}
