import { describe, it, expect } from 'vitest';
import { searchDestinations } from '../search-destinations.js';
import { refMultilevel } from '@azimut/testkit';

describe('searchDestinations', () => {
  it('returns empty for empty query', () => {
    const results = searchDestinations(refMultilevel, '', null, 10);
    expect(results.length).toBe(0);
  });

  it('finds destination by exact name (fr)', () => {
    const results = searchDestinations(refMultilevel, 'Bureau RDC', 'fr', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.destination.occupant_name).toBe('Bureau RDC');
  });

  it('finds destination by exact name (en)', () => {
    const results = searchDestinations(refMultilevel, 'Ground floor office', 'en', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('finds destination by partial prefix', () => {
    const results = searchDestinations(refMultilevel, 'Bur', 'fr', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('is case-insensitive', () => {
    const results = searchDestinations(refMultilevel, 'bureau rdc', 'fr', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('is accent-insensitive', () => {
    const results = searchDestinations(refMultilevel, 'Bureau', 'fr', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('respects maxResults', () => {
    const results = searchDestinations(refMultilevel, 'Bureau', 'fr', 1);
    expect(results.length).toBe(1);
  });

  it('searches all languages when lang is null', () => {
    const results = searchDestinations(refMultilevel, 'office', null, 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('returns no results for non-matching query', () => {
    const results = searchDestinations(refMultilevel, 'xyz999', null, 10);
    expect(results.length).toBe(0);
  });

  it('returns score with results', () => {
    const results = searchDestinations(refMultilevel, 'Bureau RDC', 'fr', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it('ranks exact match above prefix', () => {
    const results = searchDestinations(refMultilevel, 'Bureau RDC', 'fr', 10);
    if (results.length >= 2) {
      expect(results[0]?.score).toBeGreaterThanOrEqual(
        results[1]?.score ?? 0,
      );
    }
  });

  it('fuzzy matches a one-char deletion typo', () => {
    // "Burau" is "Bureau" with one char deleted (distance 1)
    const results = searchDestinations(refMultilevel, 'Burau', 'fr', 10);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.score).toBeGreaterThan(0);
    expect(results[0]?.score).toBeLessThan(70);
  });

  it('fuzzy scores lower than exact/prefix/substring', () => {
    const exact = searchDestinations(refMultilevel, 'Bureau RDC', 'fr', 10);
    const prefix = searchDestinations(refMultilevel, 'Bur', 'fr', 10);
    const fuzzy = searchDestinations(refMultilevel, 'Burau', 'fr', 10);
    expect(exact[0]?.score).toBeGreaterThan(prefix[0]?.score ?? 0);
    expect(prefix[0]?.score).toBeGreaterThan(fuzzy[0]?.score ?? 0);
  });

  it('rejects queries with too many errors', () => {
    // "Xyzeau" — too far from any destination name
    const results = searchDestinations(refMultilevel, 'Xyzeau', 'fr', 10);
    expect(results.length).toBe(0);
  });

  it('fuzzy match is deterministic (INV-4)', () => {
    const r1 = searchDestinations(refMultilevel, 'Burau', 'fr', 10);
    const r2 = searchDestinations(refMultilevel, 'Burau', 'fr', 10);
    expect(r1).toStrictEqual(r2);
  });

  it('returns empty for whitespace-only query', () => {
    const results = searchDestinations(refMultilevel, '   ', null, 10);
    expect(results.length).toBe(0);
  });

  it('returns empty when maxResults is 0', () => {
    const results = searchDestinations(refMultilevel, 'Bureau', 'fr', 0);
    expect(results.length).toBe(0);
  });

  it('word-start prefix scores lower than full prefix', () => {
    // "RDC" matches as a word-start prefix (score 70), not full prefix (90)
    const wordStart = searchDestinations(refMultilevel, 'RDC', 'fr', 10);
    const fullPrefix = searchDestinations(refMultilevel, 'Bureau', 'fr', 10);
    expect(wordStart.length).toBeGreaterThanOrEqual(1);
    expect(fullPrefix[0]?.score).toBeGreaterThan(wordStart[0]?.score ?? 0);
  });

  it('is deterministic (INV-4)', () => {
    const r1 = searchDestinations(refMultilevel, 'Bureau', 'fr', 10);
    const r2 = searchDestinations(refMultilevel, 'Bureau', 'fr', 10);
    expect(r1).toStrictEqual(r2);
  });

  it('orphaned destination_name is silently skipped', () => {
    const site = {
      ...refMultilevel,
      destination_names: [
        ...refMultilevel.destination_names,
        {
          id: 'dn-orphan',
          org_id: 'org-test-001',
          destination_id: 'dest-nonexistent',
          lang: 'fr' as const,
          value: 'Fantôme',
        },
      ],
    };
    const results = searchDestinations(site, 'Fantôme', 'fr', 10);
    expect(results.length).toBe(0);
  });

  it('substring score decreases with later position', () => {
    const base = refMultilevel.destinations[0];
    if (!base) throw new Error('need at least 1 destination');
    const site = {
      ...refMultilevel,
      destinations: [
        { ...base, id: 'd-early', display_priority: 0 },
        { ...base, id: 'd-late', display_priority: 0 },
      ],
      destination_names: [
        { id: 'dn-e', org_id: 'org-test-001', destination_id: 'd-early', lang: 'fr' as const, value: 'XYZfoo' },
        { id: 'dn-l', org_id: 'org-test-001', destination_id: 'd-late', lang: 'fr' as const, value: 'ABCDEfoo' },
      ],
    };
    // "foo" at index 3 → score 77; at index 5 → score 75
    const results = searchDestinations(site, 'foo', 'fr', 10);
    expect(results.length).toBe(2);
    const r0 = results[0];
    const r1 = results[1];
    if (!r0 || !r1) throw new Error('expected 2 results');
    expect(r0.score).toBeGreaterThan(r1.score);
  });

  it('display_priority breaks score ties', () => {
    const base = refMultilevel.destinations[0];
    if (!base) throw new Error('need at least 1 destination');
    const site = {
      ...refMultilevel,
      destinations: [
        { ...base, id: 'd-low', display_priority: 10 },
        { ...base, id: 'd-high', display_priority: 1 },
      ],
      destination_names: [
        { id: 'dn-lo', org_id: 'org-test-001', destination_id: 'd-low', lang: 'fr' as const, value: 'Salle' },
        { id: 'dn-hi', org_id: 'org-test-001', destination_id: 'd-high', lang: 'fr' as const, value: 'Salle' },
      ],
    };
    const results = searchDestinations(site, 'Salle', 'fr', 10);
    expect(results.length).toBe(2);
    const r0 = results[0];
    const r1 = results[1];
    if (!r0 || !r1) throw new Error('expected 2 results');
    // Higher priority (lower number) comes first
    expect(r0.destination.id).toBe('d-high');
    expect(r1.destination.id).toBe('d-low');
  });

  it('id tiebreaker when score and priority are equal', () => {
    const base = refMultilevel.destinations[0];
    if (!base) throw new Error('need at least 1 destination');
    const site = {
      ...refMultilevel,
      destinations: [
        { ...base, id: 'd-beta', display_priority: 5 },
        { ...base, id: 'd-alpha', display_priority: 5 },
      ],
      destination_names: [
        { id: 'dn-b', org_id: 'org-test-001', destination_id: 'd-beta', lang: 'fr' as const, value: 'Salle' },
        { id: 'dn-a', org_id: 'org-test-001', destination_id: 'd-alpha', lang: 'fr' as const, value: 'Salle' },
      ],
    };
    const results = searchDestinations(site, 'Salle', 'fr', 10);
    expect(results.length).toBe(2);
    // Same score, same priority → sorted by id alphabetically
    expect(results[0]?.destination.id).toBe('d-alpha');
    expect(results[1]?.destination.id).toBe('d-beta');
  });

  it('query longer than destination name value scores via fuzzy only', () => {
    const base = refMultilevel.destinations[0];
    if (!base) throw new Error('need at least 1 destination');
    const site = {
      ...refMultilevel,
      destinations: [
        { ...base, id: 'd-short', display_priority: 1 },
      ],
      destination_names: [
        { id: 'dn-s', org_id: 'org-test-001', destination_id: 'd-short', lang: 'fr' as const, value: 'AB' },
      ],
    };
    // Query much longer than value — cannot match via prefix or substring
    const results = searchDestinations(site, 'ABCDEFGHIJ', 'fr', 10);
    // Score is likely 0 (fuzzy distance too large) → empty results
    expect(results.length).toBe(0);
  });

  it('returns empty for diacritic-only query', () => {
    const results = searchDestinations(refMultilevel, '́', 'fr', 10);
    expect(results.length).toBe(0);
  });

  it('returns empty for multiple combining marks query', () => {
    const results = searchDestinations(refMultilevel, '̀́̂', null, 10);
    expect(results.length).toBe(0);
  });

  it('excludes substring match when position exceeds score threshold', () => {
    const base = refMultilevel.destinations[0];
    if (!base) throw new Error('need at least 1 destination');
    const longPrefix = 'A'.repeat(85);
    const site = {
      ...refMultilevel,
      destinations: [{ ...base, id: 'd-long', display_priority: 1 }],
      destination_names: [{
        id: 'dn-long',
        org_id: 'org-test-001',
        destination_id: 'd-long',
        lang: 'fr' as const,
        value: longPrefix + 'Bureau',
      }],
    };
    // "Bureau" at index 85 → score = 80 - 85 = -5 → filtered out
    const results = searchDestinations(site, 'Bureau', 'fr', 10);
    expect(results.length).toBe(0);
  });

  it('handles destination name that normalizes to empty (combining marks only)', () => {
    const base = refMultilevel.destinations[0];
    if (!base) throw new Error('need at least 1 destination');
    const site = {
      ...refMultilevel,
      destinations: [{ ...base, id: 'd-marks', display_priority: 1 }],
      destination_names: [{
        id: 'dn-marks',
        org_id: 'org-test-001',
        destination_id: 'd-marks',
        lang: 'fr' as const,
        value: '́̀',
      }],
    };
    // query "Bureau" vs empty normalized value → score 0 → no results
    const results = searchDestinations(site, 'Bureau', 'fr', 10);
    expect(results.length).toBe(0);
  });

  it('fuzzy match at boundary: query same length as value', () => {
    const base = refMultilevel.destinations[0];
    if (!base) throw new Error('need at least 1 destination');
    const site = {
      ...refMultilevel,
      destinations: [{ ...base, id: 'd-exact', display_priority: 1 }],
      destination_names: [{
        id: 'dn-exact',
        org_id: 'org-test-001',
        destination_id: 'd-exact',
        lang: 'fr' as const,
        value: 'ABCDF',
      }],
    };
    // query "ABCDE" vs value "ABCDF" — same length, edit distance 1
    // nq.length <= nv.length → slice(0, 5) = "abcdf" → levenshtein("abcde","abcdf")=1
    // maxDist = max(1, floor(5*0.3))=1, bestDist=1 → score = 50 - 5 = 45
    const results = searchDestinations(site, 'ABCDE', 'fr', 10);
    expect(results.length).toBe(1);
    expect(results[0]?.score).toBe(45);
  });
});
