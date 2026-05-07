import { Project, ScriptTarget, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { stat } from 'node:fs/promises';
import type { ClassifiedFile, Finding, ParseError, SkippedFile, Thresholds } from '../types.js';
import { analyzeComplexity, calculateComplexity } from './metrics/complexity.js';
import { analyzeFunctionLengths, analyzeFileLength } from './metrics/length.js';
import { analyzeNesting } from './metrics/nesting.js';
import { analyzeParams } from './metrics/params.js';
import { analyzeMagicNumbers } from './metrics/magicNumbers.js';
import { analyzeTodos } from './metrics/todos.js';
import { analyzeUnusedExports } from './metrics/unusedExports.js';

const MAX_FILE_BYTES = 1_048_576; // 1 MB

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
];

export interface AstAnalysisResult {
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
}

interface PerFileMetrics {
  complexity: Finding[];
  longFunctions: Finding[];
  deepNesting: Finding[];
  longParamLists: Finding[];
  magicNumbers: Finding[];
  todos: Finding[];
  fileLength: Finding[];
  totalFunctions: number;
  complexityScores: number[];
}

async function addAnalyzableFiles(
  project: Project,
  files: ClassifiedFile[],
): Promise<{ added: ClassifiedFile[]; parseErrors: ParseError[]; skipped: SkippedFile[] }> {
  const added: ClassifiedFile[] = [];
  const parseErrors: ParseError[] = [];
  const skipped: SkippedFile[] = [];
  for (const file of files) {
    if (!file.isAnalyzable) continue;
    try {
      const s = await stat(file.absolutePath);
      if (s.size > MAX_FILE_BYTES) {
        skipped.push({ file: file.relativePath, reason: 'too-large' });
        continue;
      }
    } catch {
      skipped.push({ file: file.relativePath, reason: 'unreadable' });
      continue;
    }
    try {
      project.addSourceFileAtPath(file.absolutePath);
      added.push(file);
    } catch (err) {
      parseErrors.push({
        file: file.relativePath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { added, parseErrors, skipped };
}

function runPerFileMetrics(
  sourceFile: SourceFile,
  rel: string,
  thresholds: Thresholds,
): PerFileMetrics {
  const metrics: PerFileMetrics = {
    complexity: analyzeComplexity(sourceFile, rel, thresholds.maxComplexity),
    longFunctions: analyzeFunctionLengths(sourceFile, rel, thresholds.maxFunctionLines),
    deepNesting: analyzeNesting(sourceFile, rel, thresholds.maxNesting),
    longParamLists: analyzeParams(sourceFile, rel, thresholds.maxParams),
    magicNumbers: analyzeMagicNumbers(sourceFile, rel),
    todos: analyzeTodos(sourceFile, rel),
    fileLength: analyzeFileLength(sourceFile, rel, thresholds.maxFileLines),
    totalFunctions: 0,
    complexityScores: [],
  };

  // Aggregates: count every function and gather raw complexity scores.
  sourceFile.forEachDescendant((node: Node) => {
    if (FUNCTION_KINDS.includes(node.getKind())) {
      metrics.totalFunctions++;
      metrics.complexityScores.push(calculateComplexity(node));
    }
  });

  return metrics;
}

export async function runAstAnalysis(
  rootDir: string,
  files: ClassifiedFile[],
  thresholds: Thresholds,
): Promise<AstAnalysisResult> {
  const result: AstAnalysisResult = {
    filesAnalyzed: 0,
    parseErrors: [],
    skipped: [],
    findings: {
      complexity: [],
      longFunctions: [],
      deepNesting: [],
      longParamLists: [],
      magicNumbers: [],
      unusedExports: [],
      todos: [],
      fileLength: [],
    },
    totalFunctions: 0,
    complexityScores: [],
  };

  const project = new Project({
    compilerOptions: { allowJs: true, target: ScriptTarget.ES2022 },
    skipFileDependencyResolution: true,
    skipAddingFilesFromTsConfig: true,
  });

  const { added, parseErrors, skipped } = await addAnalyzableFiles(project, files);
  result.parseErrors.push(...parseErrors);
  result.skipped.push(...skipped);

  for (const file of added) {
    const sourceFile = project.getSourceFile(file.absolutePath);
    if (!sourceFile) continue;
    const rel = file.relativePath;

    try {
      const metrics = runPerFileMetrics(sourceFile, rel, thresholds);
      result.findings.complexity.push(...metrics.complexity);
      result.findings.longFunctions.push(...metrics.longFunctions);
      result.findings.deepNesting.push(...metrics.deepNesting);
      result.findings.longParamLists.push(...metrics.longParamLists);
      result.findings.magicNumbers.push(...metrics.magicNumbers);
      result.findings.todos.push(...metrics.todos);
      result.findings.fileLength.push(...metrics.fileLength);
      result.totalFunctions += metrics.totalFunctions;
      result.complexityScores.push(...metrics.complexityScores);
      result.filesAnalyzed++;
    } catch (err) {
      result.parseErrors.push({
        file: rel,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Project-wide unused exports (cross-file).
  try {
    result.findings.unusedExports.push(...analyzeUnusedExports(project, rootDir));
  } catch {
    // unused-exports requires resolved imports; tolerate failures so a partial
    // report is still emitted.
  }

  return result;
}
