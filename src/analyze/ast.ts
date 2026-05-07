import { Project, ScriptTarget, SyntaxKind, Node } from 'ts-morph';
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

  const analyzableFiles: ClassifiedFile[] = [];
  for (const file of files) {
    if (!file.isAnalyzable) continue;
    try {
      const s = await stat(file.absolutePath);
      if (s.size > MAX_FILE_BYTES) {
        result.skipped.push({ file: file.relativePath, reason: 'too-large' });
        continue;
      }
    } catch {
      result.skipped.push({ file: file.relativePath, reason: 'unreadable' });
      continue;
    }
    try {
      project.addSourceFileAtPath(file.absolutePath);
      analyzableFiles.push(file);
    } catch (err) {
      result.parseErrors.push({
        file: file.relativePath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const file of analyzableFiles) {
    const sourceFile = project.getSourceFile(file.absolutePath);
    if (!sourceFile) continue;
    const rel = file.relativePath;

    try {
      result.findings.complexity.push(
        ...analyzeComplexity(sourceFile, rel, thresholds.maxComplexity),
      );
      result.findings.longFunctions.push(
        ...analyzeFunctionLengths(sourceFile, rel, thresholds.maxFunctionLines),
      );
      result.findings.deepNesting.push(
        ...analyzeNesting(sourceFile, rel, thresholds.maxNesting),
      );
      result.findings.longParamLists.push(
        ...analyzeParams(sourceFile, rel, thresholds.maxParams),
      );
      result.findings.magicNumbers.push(...analyzeMagicNumbers(sourceFile, rel));
      result.findings.todos.push(...analyzeTodos(sourceFile, rel));
      result.findings.fileLength.push(
        ...analyzeFileLength(sourceFile, rel, thresholds.maxFileLines),
      );

      // Aggregates: count every function and gather raw complexity scores.
      sourceFile.forEachDescendant((node: Node) => {
        if (FUNCTION_KINDS.includes(node.getKind())) {
          result.totalFunctions++;
          result.complexityScores.push(calculateComplexity(node));
        }
      });

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
