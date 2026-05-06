import { describe, it, expect } from 'vitest';
import { DEFAULT_THRESHOLDS, mergeThresholds } from '../../src/config/thresholds.js';

describe('mergeThresholds', () => {
  it('returns defaults when no overrides given', () => {
    expect(mergeThresholds({})).toEqual(DEFAULT_THRESHOLDS);
  });

  it('overrides individual fields', () => {
    const merged = mergeThresholds({ maxComplexity: 20 });
    expect(merged.maxComplexity).toBe(20);
    expect(merged.maxFunctionLines).toBe(DEFAULT_THRESHOLDS.maxFunctionLines);
  });

  it('ignores undefined values', () => {
    const merged = mergeThresholds({ maxComplexity: undefined, maxNesting: 7 });
    expect(merged.maxComplexity).toBe(DEFAULT_THRESHOLDS.maxComplexity);
    expect(merged.maxNesting).toBe(7);
  });
});
