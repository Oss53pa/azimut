import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { searchDestinations } from '../search-destinations.js';
import { computeWayfinding } from '../wayfinding-session.js';
import { refMultilevel } from '@azimut/testkit';

/**
 * D10.5 — Autonomy check.
 *
 * The kiosk runtime must run the full user journey without a single outbound
 * request (INV-1). Here we trap every network global; if the journey touches
 * any of them the test fails — that attempt is exactly what would raise
 * PACKAGE.NETWORK_DEPENDENCY in a served package.
 */

type NetGlobals = Record<string, unknown>;

const NETWORK_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
] as const;

describe('D10.5 — kiosk journey makes no outbound request', () => {
  const attempts: string[] = [];
  const saved: NetGlobals = {};
  const g = globalThis as unknown as NetGlobals;

  beforeEach(() => {
    attempts.length = 0;
    for (const name of NETWORK_GLOBALS) {
      saved[name] = g[name];
      g[name] = (...args: unknown[]): never => {
        attempts.push(`${name}(${String(args[0])})`);
        throw new Error(`outbound network call attempted: ${name}`);
      };
    }
    // navigator.sendBeacon, if present.
    const nav = (g['navigator'] ?? undefined) as { sendBeacon?: unknown } | undefined;
    if (nav && typeof nav.sendBeacon !== 'undefined') {
      saved['__sendBeacon'] = nav.sendBeacon;
      nav.sendBeacon = (): never => {
        attempts.push('sendBeacon');
        throw new Error('outbound network call attempted: sendBeacon');
      };
    }
  });

  afterEach(() => {
    for (const name of NETWORK_GLOBALS) {
      g[name] = saved[name];
    }
    const nav = (g['navigator'] ?? undefined) as { sendBeacon?: unknown } | undefined;
    if (nav && '__sendBeacon' in saved) {
      nav.sendBeacon = saved['__sendBeacon'];
    }
  });

  it('runs search + wayfinding in every active language with zero network calls', () => {
    const site = refMultilevel;
    const profile = site.travel_profiles.find((p) => p.key === 'standard');
    if (!profile) throw new Error('missing profile');
    const entrance = 'n-ml-hall';

    const query: Record<'fr' | 'en', string> = { fr: 'Bureau', en: 'office' };
    for (const lang of ['fr', 'en'] as const) {
      const results = searchDestinations(site, query[lang], lang, 5);
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        const wf = computeWayfinding(
          site, profile, entrance, r.destination.node_id, { lang },
        );
        // Reaching a result (ok or a clean failure) must not require the network.
        expect(typeof wf.ok).toBe('boolean');
      }
    }

    expect(attempts).toEqual([]);
  });
});
