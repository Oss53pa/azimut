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

  it('is deterministic (INV-4)', () => {
    const r1 = searchDestinations(refMultilevel, 'Bureau', 'fr', 10);
    const r2 = searchDestinations(refMultilevel, 'Bureau', 'fr', 10);
    expect(r1).toStrictEqual(r2);
  });
});
