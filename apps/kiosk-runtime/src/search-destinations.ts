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

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n] ?? m;
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

  // Fuzzy match: compare against each word, keep the best score.
  // Allow up to ~30% edit distance relative to query length.
  const maxDist = Math.max(1, Math.floor(nq.length * 0.3));
  let bestDist = maxDist + 1;
  for (const w of words) {
    const d = levenshtein(nq, w);
    if (d < bestDist) bestDist = d;
  }
  // Also compare against the whole value for short queries.
  if (nq.length <= nv.length) {
    const d = levenshtein(nq, nv.slice(0, nq.length));
    if (d < bestDist) bestDist = d;
  }
  if (bestDist <= maxDist) {
    return 50 - bestDist * 5;
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
