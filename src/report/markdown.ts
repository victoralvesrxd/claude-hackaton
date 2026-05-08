import { writeFile } from 'node:fs/promises';
import type { DuplicationFinding, Finding, Report } from '../types.js';

export async function writeMarkdownReport(report: Report, outPath: string, topN: number): Promise<void> {
  const md = renderMarkdown(report, topN);
  await writeFile(outPath, md, 'utf8');
}

export function renderMarkdown(report: Report, topN: number): string {
  const out: string[] = [];
  out.push('# Code Ratings report');
  out.push('');
  out.push(`**Target:** \`${report.meta.target}\``);
  out.push(`**Scanned at:** ${report.meta.scannedAt} (${report.meta.durationMs} ms)`);
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push(`- **Total files:** ${report.summary.totalFiles}`);
  out.push(`- **Total lines:** ${report.summary.totalLines}`);
  out.push('');
  const langs = Object.entries(report.summary.languages).sort((a, b) => b[1].lines - a[1].lines);
  if (langs.length) {
    out.push('| Language | Files | Lines |');
    out.push('|---|---|---|');
    for (const [name, stat] of langs) out.push(`| ${name} | ${stat.files} | ${stat.lines} |`);
    out.push('');
  }
  out.push('## Analysis');
  out.push('');
  out.push(`- **Files analyzed:** ${report.analysis.filesAnalyzed}`);
  out.push(`- **Total functions:** ${report.analysis.aggregates.totalFunctions}`);
  out.push(`- **Avg / Max complexity:** ${report.analysis.aggregates.avgComplexity} / ${report.analysis.aggregates.maxComplexity}`);
  out.push(`- **Violations:** ${report.analysis.violations.total}`);
  if (report.analysis.parseErrors.length) {
    out.push(`- **Parse errors:** ${report.analysis.parseErrors.length}`);
  }
  if (report.meta.skipped.length) {
    out.push(`- **Skipped files:** ${report.meta.skipped.length}`);
  }
  out.push('');

  pushCategory(out, 'Complexity', report.analysis.findings.complexity, topN);
  pushCategory(out, 'Long functions / files', report.analysis.findings.longFunctions, topN);
  pushCategory(out, 'Deep nesting', report.analysis.findings.deepNesting, topN);
  pushCategory(out, 'Long parameter lists', report.analysis.findings.longParamLists, topN);
  pushCategory(out, 'Magic numbers', report.analysis.findings.magicNumbers, topN);
  pushCategory(out, 'Unused exports', report.analysis.findings.unusedExports, topN);
  pushCategory(out, 'TODO/FIXME', report.analysis.findings.todos, topN);
  pushDuplicates(out, report.analysis.findings.duplicates, topN);

  return out.join('\n');
}

function pushCategory(out: string[], title: string, findings: Finding[], topN: number): void {
  if (findings.length === 0) return;
  out.push(`## ${title} (${findings.length})`);
  out.push('');
  out.push('| File:Line | Symbol | Value | Threshold |');
  out.push('|---|---|---|---|');
  const sorted = [...findings].sort((a, b) => b.value - a.value).slice(0, topN);
  for (const f of sorted) {
    out.push(`| ${f.file}:${f.line} | ${f.symbol ?? '—'} | ${f.value} | ${f.threshold} |`);
  }
  out.push('');
}

function pushDuplicates(out: string[], dups: DuplicationFinding[], topN: number): void {
  if (dups.length === 0) return;
  out.push(`## Duplicates (${dups.length})`);
  out.push('');
  out.push('| Locations | Lines |');
  out.push('|---|---|');
  const sorted = [...dups].slice(0, topN);
  for (const d of sorted) {
    const locs = d.occurrences.map((o) => `${o.file}:${o.startLine}-${o.endLine}`).join('<br>');
    const lineCount = d.occurrences[0] ? d.occurrences[0].endLine - d.occurrences[0].startLine + 1 : 0;
    out.push(`| ${locs} | ${lineCount} |`);
  }
  out.push('');
}
