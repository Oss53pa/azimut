import type { SiteData, Destination, DestinationName } from '@azimut/core-model';

export type SearchResult = {
  readonly destination: Destination;
  readonly matched_name: DestinationName;
  readonly score: number;
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function computeScore(query: string, value: string): number {
  const nq = normalize(query);
  const nv = normalize(value);
  if (nq.length === 0) return 0;

  if (nv === nq) return 100;
  if (nv.startsWith(nq)) return 90;

  const idx = nv.indexOf(nq);
  if (idx >= 0) return 80 - idx;

  const words = nv.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(nq)) return 70;
  }

  return 0;
}

export function searchDestinations(
  site: SiteData,
  query: string,
  lang: 'fr' | 'en' | null,
  maxResults: number,
): readonly SearchResult[] {
  if (query.trim().length === 0) return [];

  const destMap = new Map(
    site.destinations.map((d) => [d.id, d]),
  );

  const results: SearchResult[] = [];

  const filteredNames = lang
    ? site.destination_names.filter((dn) => dn.lang === lang)
    : site.destination_names;

  const sortedNames = [...filteredNames].sort(
    (a, b) => a.id.localeCompare(b.id),
  );

  for (const dn of sortedNames) {
    const score = computeScore(query, dn.value);
    if (score <= 0) continue;

    const dest = destMap.get(dn.destination_id);
    if (!dest) continue;

    results.push({
      destination: dest,
      matched_name: dn,
      score,
    });
  }

  results.sort(
    (a, b) => b.score - a.score
      || a.destination.display_priority - b.destination.display_priority
      || a.destination.id.localeCompare(b.destination.id),
  );

  return results.slice(0, maxResults);
}
