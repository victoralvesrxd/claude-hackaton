#!/usr/bin/env node
import { Command } from 'commander';
import { runPipeline } from './pipeline.js';
import { mergeThresholds } from './config/thresholds.js';
import { renderTerminal } from './report/terminal.js';
import { writeJsonReport } from './report/json.js';
import { writeMarkdownReport } from './report/markdown.js';
import { writeHtmlReport } from './report/html.js';
import { ScannerError } from './errors.js';

interface CliOptions {
  json?: string;
  markdown?: string;
  html?: string;
  maxComplexity?: string;
  maxFunctionLines?: string;
  maxFileLines?: string;
  maxNesting?: string;
  maxParams?: string;
  topN?: string;
  verbose?: boolean;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('code-ratings')
    .description('Code Ratings — walks a codebase, extracts metrics, grades quality on a Moody\'s-style scale')
    .version('0.1.0', '-V, --version')
    .argument('<directory>', 'directory to scan')
    .option('-j, --json <path>', 'write JSON report to <path>')
    .option('-m, --markdown <path>', 'write Markdown report to <path>')
    .option('-H, --html <path>', 'write HTML scorecard to <path>')
    .option('--max-complexity <n>', 'cyclomatic complexity threshold per function')
    .option('--max-function-lines <n>', 'max lines per function')
    .option('--max-file-lines <n>', 'max lines per file')
    .option('--max-nesting <n>', 'max nesting depth per function')
    .option('--max-params <n>', 'max parameters per function')
    .option('-n, --top-n <n>', 'how many worst offenders to show', '10')
    .option('-v, --verbose', 'log skipped files and warnings to stderr', false)
    .action(async (directory: string, options: CliOptions) => {
      const thresholds = mergeThresholds({
        maxComplexity: parseIntOrUndefined(options.maxComplexity),
        maxFunctionLines: parseIntOrUndefined(options.maxFunctionLines),
        maxFileLines: parseIntOrUndefined(options.maxFileLines),
        maxNesting: parseIntOrUndefined(options.maxNesting),
        maxParams: parseIntOrUndefined(options.maxParams),
      });
      const topN = parseIntOrUndefined(options.topN) ?? 10;

      const report = await runPipeline(directory, thresholds);

      const noColor = !process.stdout.isTTY;
      process.stdout.write(renderTerminal(report, topN, noColor) + '\n');

      if (options.json) await writeJsonReport(report, options.json);
      if (options.markdown) await writeMarkdownReport(report, options.markdown, topN);
      if (options.html) await writeHtmlReport(report, options.html);

      if (options.verbose && report.meta.skipped.length) {
        for (const s of report.meta.skipped) {
          process.stderr.write(`skipped: ${s.file} (${s.reason})\n`);
        }
      }

      process.exit(report.analysis.violations.total === 0 ? 0 : 1);
    });

  await program.parseAsync(process.argv);
}

function parseIntOrUndefined(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

main().catch((err: unknown) => {
  if (err instanceof ScannerError && err.kind === 'fatal') {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(2);
  }
  process.stderr.write(
    `unexpected error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(2);
});
