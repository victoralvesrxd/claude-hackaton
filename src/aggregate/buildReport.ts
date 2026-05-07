import type {
  DuplicationFinding,
  ParseError,
  Report,
  Finding,
  SkippedFile,
  Summary,
  Thresholds,
  Violations,
} from '../types.js';

export interface BuildReportInput {
  target: string;
  scannedAt: string;
  durationMs: number;
  scannerVersion: string;
  thresholds: Thresholds;
  summary: Summary;
  ast: {
    filesAnalyzed: number;
    parseErrors: ParseError[];
    skipped: SkippedFile[];
    findings: {
      complexity: Finding[];
      longFunctions: Finding[];
      deepNesting: Finding[];
      longParamLists: Finding[];
      magicNumbers: Finding[];
      unusedExports: Finding[];
      todos: Finding[];
      fileLength: Finding[];
    };
    totalFunctions: number;
    complexityScores: number[];
  };
  duplicates: DuplicationFinding[];
}

export function buildReport(input: BuildReportInput): Report {
  const avg =
    input.ast.complexityScores.length === 0
      ? 0
      : input.ast.complexityScores.reduce((a, b) => a + b, 0) / input.ast.complexityScores.length;
  const max =
    input.ast.complexityScores.length === 0 ? 0 : Math.max(...input.ast.complexityScores);

  const findings = {
    complexity: input.ast.findings.complexity,
    longFunctions: [...input.ast.findings.longFunctions, ...input.ast.findings.fileLength],
    deepNesting: input.ast.findings.deepNesting,
    longParamLists: input.ast.findings.longParamLists,
    magicNumbers: input.ast.findings.magicNumbers,
    unusedExports: input.ast.findings.unusedExports,
    todos: input.ast.findings.todos,
    duplicates: input.duplicates,
  };

  const byCategory: Record<string, number> = {
    complexity: findings.complexity.length,
    longFunctions: findings.longFunctions.length,
    deepNesting: findings.deepNesting.length,
    longParamLists: findings.longParamLists.length,
    magicNumbers: findings.magicNumbers.length,
    unusedExports: findings.unusedExports.length,
    todos: findings.todos.length,
    duplicates: findings.duplicates.length,
  };
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const violations: Violations = { total, byCategory };

  return {
    summary: input.summary,
    analysis: {
      filesAnalyzed: input.ast.filesAnalyzed,
      parseErrors: input.ast.parseErrors,
      aggregates: {
        totalFunctions: input.ast.totalFunctions,
        avgComplexity: Number(avg.toFixed(2)),
        maxComplexity: max,
      },
      findings,
      violations,
    },
    meta: {
      target: input.target,
      scannedAt: input.scannedAt,
      durationMs: input.durationMs,
      scannerVersion: input.scannerVersion,
      thresholds: input.thresholds,
      skipped: input.ast.skipped,
    },
  };
}
