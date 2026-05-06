import type { Thresholds } from '../types.js';

export const DEFAULT_THRESHOLDS: Thresholds = {
  maxComplexity: 10,
  maxFunctionLines: 50,
  maxFileLines: 300,
  maxNesting: 4,
  maxParams: 4,
};

export function mergeThresholds(overrides: Partial<Thresholds>): Thresholds {
  const merged: Thresholds = { ...DEFAULT_THRESHOLDS };
  for (const key of Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[]) {
    const value = overrides[key];
    if (typeof value === 'number') {
      merged[key] = value;
    }
  }
  return merged;
}
