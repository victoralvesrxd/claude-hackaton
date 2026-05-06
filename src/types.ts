export interface LanguageStat {
  files: number;
  lines: number;
}

export interface Summary {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, LanguageStat>;
}

export interface Finding {
  file: string;
  line: number;
  endLine?: number;
  symbol?: string;
  value: number;
  threshold: number;
}

export interface DuplicationFinding {
  tokens: number;
  occurrences: { file: string; startLine: number; endLine: number }[];
}

export interface Findings {
  complexity: Finding[];
  longFunctions: Finding[];
  deepNesting: Finding[];
  longParamLists: Finding[];
  magicNumbers: Finding[];
  unusedExports: Finding[];
  todos: Finding[];
  duplicates: DuplicationFinding[];
}

export interface Aggregates {
  totalFunctions: number;
  avgComplexity: number;
  maxComplexity: number;
}

export interface Violations {
  total: number;
  byCategory: Record<string, number>;
}

export interface ParseError {
  file: string;
  message: string;
}

export type SkipReason = 'binary' | 'too-large' | 'unreadable';

export interface SkippedFile {
  file: string;
  reason: SkipReason;
}

export interface Thresholds {
  maxComplexity: number;
  maxFunctionLines: number;
  maxFileLines: number;
  maxNesting: number;
  maxParams: number;
}

export interface Meta {
  target: string;
  scannedAt: string;
  durationMs: number;
  scannerVersion: string;
  thresholds: Thresholds;
  skipped: SkippedFile[];
}

export interface Analysis {
  filesAnalyzed: number;
  parseErrors: ParseError[];
  aggregates: Aggregates;
  findings: Findings;
  violations: Violations;
}

export interface Report {
  summary: Summary;
  analysis: Analysis;
  meta: Meta;
}

export interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
}

export interface ClassifiedFile extends DiscoveredFile {
  language: string;
  lines: number;
  isAnalyzable: boolean;
}
