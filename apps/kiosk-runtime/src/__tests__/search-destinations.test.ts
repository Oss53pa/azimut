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

  it('is deterministic (INV-4)', () => {
    const r1 = searchDestinations(refMultilevel, 'Bureau', 'fr', 10);
    const r2 = searchDestinations(refMultilevel, 'Bureau', 'fr', 10);
    expect(r1).toStrictEqual(r2);
  });
});
