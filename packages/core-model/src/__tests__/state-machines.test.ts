import { describe, it, expect } from 'vitest';
import {
  assertProofTransition,
  assertJobTransition,
  assertDivergenceTransition,
  assertWorkOrderTransition,
} from '../index.js';

describe('D9.1 — proof version state machine', () => {
  it.each([
    ['draft', 'in_review'],
    ['draft', 'draft'],
    ['in_review', 'draft'],
    ['in_review', 'approved'],
    ['approved', 'superseded'],
  ])('allows %s → %s', (from, to) => {
    expect(() => assertProofTransition(from, to)).not.toThrow();
  });

  it.each([
    ['approved', 'draft'],
    ['approved', 'in_review'],
    ['superseded', 'draft'],
    ['in_review', 'superseded'],
    ['draft', 'approved'],
  ])('forbids %s → %s', (from, to) => {
    expect(() => assertProofTransition(from, to)).toThrow(/forbidden/);
  });
});

describe('D9.2 — job state machine', () => {
  it.each([
    ['queued', 'running'],
    ['queued', 'cancelled'],
    ['running', 'succeeded'],
    ['running', 'failed'],
    ['running', 'queued'],
  ])('allows %s → %s', (from, to) => {
    expect(() => assertJobTransition(from, to)).not.toThrow();
  });

  it.each([
    ['succeeded', 'running'],
    ['failed', 'queued'],
    ['cancelled', 'queued'],
    ['running', 'cancelled'],
  ])('forbids %s → %s', (from, to) => {
    expect(() => assertJobTransition(from, to)).toThrow(/forbidden/);
  });
});

describe('D9.3 — divergence state machine', () => {
  it.each([
    ['detected', 'resolved'],
    ['detected', 'accepted'],
  ])('allows %s → %s', (from, to) => {
    expect(() => assertDivergenceTransition(from, to)).not.toThrow();
  });

  it.each([
    ['resolved', 'detected'],
    ['accepted', 'detected'],
  ])('forbids %s → %s', (from, to) => {
    expect(() => assertDivergenceTransition(from, to)).toThrow(/forbidden/);
  });
});

describe('D9.4 — work order state machine', () => {
  it.each([
    ['draft', 'issued'],
    ['draft', 'cancelled'],
    ['issued', 'in_progress'],
    ['issued', 'cancelled'],
    ['in_progress', 'done'],
    ['in_progress', 'cancelled'],
  ])('allows %s → %s', (from, to) => {
    expect(() => assertWorkOrderTransition(from, to)).not.toThrow();
  });

  it.each([
    ['done', 'cancelled'],
    ['done', 'draft'],
    ['cancelled', 'draft'],
    ['in_progress', 'draft'],
  ])('forbids %s → %s', (from, to) => {
    expect(() => assertWorkOrderTransition(from, to)).toThrow(/forbidden/);
  });
});
