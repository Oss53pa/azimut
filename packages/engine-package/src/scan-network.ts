import type { Outcome, Finding } from '@azimut/core-model';

export type NetworkScanResult = {
  readonly scanned_count: number;
  readonly clean_count: number;
};

/**
 * Patterns that indicate outbound network requests in kiosk HTML/JS/CSS.
 *
 * Each entry is [regex, human-readable label].
 * Order is deterministic (array, not object).
 */
const NETWORK_PATTERNS: readonly [RegExp, string][] = [
  [/\bfetch\s*\(/g, 'fetch()'],
  [/\bXMLHttpRequest\b/g, 'XMLHttpRequest'],
  [/\bnew\s+WebSocket\b/g, 'WebSocket'],
  [/\bnavigator\.sendBeacon\b/g, 'navigator.sendBeacon'],
  [/\bnew\s+EventSource\b/g, 'EventSource'],
  [/<script[^>]+src\s*=\s*["']https?:\/\//gi, '<script src="http...">'],
  [/<link[^>]+href\s*=\s*["']https?:\/\//gi, '<link href="http...">'],
  [/<img[^>]+src\s*=\s*["']https?:\/\//gi, '<img src="http...">'],
  [/\bimport\s*\(\s*["']https?:\/\//g, 'dynamic import("http...")'],
  [/url\(\s*["']?https?:\/\//gi, 'CSS url(http...)'],
];

const decoder = new TextDecoder();

/**
 * Scan kiosk package artifacts for patterns indicating outbound network
 * requests. Kiosk packages must run fully offline (INV-1), so any
 * network dependency is a blocking defect.
 *
 * Only text-decodable artifacts are scanned (HTML, JS, CSS, JSON).
 * Binary artifacts (PDF, images) are skipped.
 */
export function scanForNetworkDependency(
  artifacts: ReadonlyMap<string, Uint8Array>,
): Outcome<NetworkScanResult> {
  const findings: Finding[] = [];
  const sortedIds = [...artifacts.keys()].sort();

  let cleanCount = 0;

  for (const id of sortedIds) {
    const content = artifacts.get(id) as Uint8Array;

    // Skip empty artifacts.
    if (content.length === 0) {
      cleanCount++;
      continue;
    }

    // Attempt text decode; skip binary content.
    let text: string;
    try {
      text = decoder.decode(content);
    } catch {
      cleanCount++;
      continue;
    }

    // Check if content looks binary (contains null bytes in first 512 chars).
    if (text.slice(0, 512).includes('\0')) {
      cleanCount++;
      continue;
    }

    const matched = new Set<string>();
    for (const [pattern, label] of NETWORK_PATTERNS) {
      // Reset regex state for each artifact.
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        matched.add(label);
      }
    }

    if (matched.size > 0) {
      const sortedLabels = [...matched].sort();
      findings.push({
        code: 'PACKAGE.NETWORK_DEPENDENCY',
        severity: 'blocking',
        entity: { kind: 'artifact', id },
        params: {
          patterns: sortedLabels.join(', '),
          pattern_count: sortedLabels.length,
        },
        ruleRef: null,
      });
    } else {
      cleanCount++;
    }
  }

  const result: NetworkScanResult = {
    scanned_count: sortedIds.length,
    clean_count: cleanCount,
  };

  if (findings.length > 0) {
    return { ok: false, findings };
  }

  return { ok: true, value: result, warnings: [] };
}
