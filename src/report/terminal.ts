import chalk from 'chalk';
import Table from 'cli-table3';
import type { DuplicationFinding, Finding, Report } from '../types.js';

export function renderTerminal(report: Report, topN: number, noColor: boolean): string {
  const c = noColor ? makeNoColor() : chalk;
  const out: string[] = [];

  out.push(c.bold(c.cyan('═══ cscan report ═══')));
  out.push(`Target: ${report.meta.target}`);
  out.push(`Scanned at: ${report.meta.scannedAt}  (${report.meta.durationMs} ms)`);
  out.push('');

  out.push(c.bold('Summary'));
  out.push(`  Total files: ${report.summary.totalFiles}`);
  out.push(`  Total lines: ${report.summary.totalLines}`);
  const langs = Object.entries(report.summary.languages).sort((a, b) => b[1].lines - a[1].lines);
  if (langs.length) {
    const langTable = new Table({ head: ['Language', 'Files', 'Lines'] });
    for (const [name, stat] of langs) langTable.push([name, stat.files, stat.lines]);
    out.push(langTable.toString());
  }
  out.push('');

  out.push(c.bold('Analysis'));
  out.push(`  Files analyzed: ${report.analysis.filesAnalyzed}`);
  out.push(`  Total functions: ${report.analysis.aggregates.totalFunctions}`);
  out.push(
    `  Avg / max complexity: ${report.analysis.aggregates.avgComplexity} / ${report.analysis.aggregates.maxComplexity}`,
  );
  const violationColor = report.analysis.violations.total === 0 ? c.green : c.red;
  out.push(`  ${violationColor(`Violations: ${report.analysis.violations.total}`)}`);
  if (report.analysis.parseErrors.length) {
    out.push(c.yellow(`  Parse errors: ${report.analysis.parseErrors.length}`));
  }
  if (report.meta.skipped.length) {
    out.push(c.yellow(`  Skipped files: ${report.meta.skipped.length}`));
  }
  out.push('');

  renderCategory(out, 'Complexity', report.analysis.findings.complexity, topN);
  renderCategory(out, 'Long functions / files', report.analysis.findings.longFunctions, topN);
  renderCategory(out, 'Deep nesting', report.analysis.findings.deepNesting, topN);
  renderCategory(out, 'Long parameter lists', report.analysis.findings.longParamLists, topN);
  renderCategory(out, 'Magic numbers', report.analysis.findings.magicNumbers, topN);
  renderCategory(out, 'Unused exports', report.analysis.findings.unusedExports, topN);
  renderCategory(out, 'TODO/FIXME', report.analysis.findings.todos, topN);
  renderDuplicates(out, report.analysis.findings.duplicates, topN);

  return out.join('\n');
}

function renderCategory(out: string[], title: string, findings: Finding[], topN: number): void {
  if (findings.length === 0) return;
  out.push(
    chalk.bold(title) +
      chalk.dim(`  (${findings.length} total, showing top ${Math.min(topN, findings.length)})`),
  );
  const sorted = [...findings].sort((a, b) => b.value - a.value).slice(0, topN);
  const t = new Table({ head: ['File:Line', 'Symbol', 'Value', 'Threshold'] });
  for (const f of sorted) {
    t.push([`${f.file}:${f.line}`, f.symbol ?? '—', String(f.value), String(f.threshold)]);
  }
  out.push(t.toString());
  out.push('');
}

function renderDuplicates(out: string[], dups: DuplicationFinding[], topN: number): void {
  if (dups.length === 0) return;
  out.push(
    chalk.bold('Duplicates') +
      chalk.dim(`  (${dups.length} total, showing top ${Math.min(topN, dups.length)})`),
  );
  const sorted = [...dups].slice(0, topN);
  const t = new Table({ head: ['Locations', 'Lines'] });
  for (const d of sorted) {
    const locs = d.occurrences.map((o) => `${o.file}:${o.startLine}-${o.endLine}`).join('\n');
    const lineCount = d.occurrences[0] ? d.occurrences[0].endLine - d.occurrences[0].startLine + 1 : 0;
    t.push([locs, String(lineCount)]);
  }
  out.push(t.toString());
  out.push('');
}

function makeNoColor(): typeof chalk {
  const passthrough = ((s: string) => s) as unknown as typeof chalk;
  return new Proxy(passthrough, {
    get: () => makeNoColor(),
    apply: (_t, _this, args: unknown[]) => String(args[0] ?? ''),
  });
}
