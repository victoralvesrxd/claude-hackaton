import { walkDirectory } from './discover/walk.js';
import { detectLanguage, isAnalyzable } from './classify/extensions.js';
import { countLines, isBinary } from './classify/countLines.js';
import { runAstAnalysis } from './analyze/ast.js';
import { runDuplicationScan } from './analyze/duplication.js';
import { buildReport } from './aggregate/buildReport.js';
import type { ClassifiedFile, Report, SkippedFile, Summary, Thresholds } from './types.js';
import path from 'node:path';

const SCANNER_VERSION = '0.1.0';

export async function runPipeline(targetDir: string, thresholds: Thresholds): Promise<Report> {
  const start = Date.now();
  const absoluteTarget = path.resolve(targetDir);

  const discovered = await walkDirectory(absoluteTarget);
  const classified: ClassifiedFile[] = [];
  const skipped: SkippedFile[] = [];
  const summary: Summary = { totalFiles: 0, totalLines: 0, languages: {} };

  for (const file of discovered) {
    let binary = false;
    try {
      binary = await isBinary(file.absolutePath);
    } catch {
      skipped.push({ file: file.relativePath, reason: 'unreadable' });
      continue;
    }
    if (binary) {
      skipped.push({ file: file.relativePath, reason: 'binary' });
      continue;
    }

    let lines = 0;
    try {
      lines = await countLines(file.absolutePath);
    } catch {
      skipped.push({ file: file.relativePath, reason: 'unreadable' });
      continue;
    }

    const language = detectLanguage(file.relativePath);
    classified.push({
      ...file,
      language,
      lines,
      isAnalyzable: isAnalyzable(file.relativePath),
    });

    summary.totalFiles++;
    summary.totalLines += lines;
    const stat = summary.languages[language] ?? { files: 0, lines: 0 };
    stat.files++;
    stat.lines += lines;
    summary.languages[language] = stat;
  }

  const [astResult, duplicates] = await Promise.all([
    runAstAnalysis(absoluteTarget, classified, thresholds),
    runDuplicationScan(absoluteTarget),
  ]);

  return buildReport({
    target: absoluteTarget,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    scannerVersion: SCANNER_VERSION,
    thresholds,
    summary,
    ast: {
      filesAnalyzed: astResult.filesAnalyzed,
      parseErrors: astResult.parseErrors,
      skipped: [...skipped, ...astResult.skipped],
      findings: astResult.findings,
      totalFunctions: astResult.totalFunctions,
      complexityScores: astResult.complexityScores,
    },
    duplicates,
  });
}
