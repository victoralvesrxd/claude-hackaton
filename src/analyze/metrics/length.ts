import { SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';
import { getFunctionName } from './functionName.js';

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
];

export function analyzeFunctionLengths(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!FUNCTION_KINDS.includes(node.getKind())) return;
    const start = node.getStartLineNumber();
    const end = node.getEndLineNumber();
    const lines = end - start + 1;
    if (lines > threshold) {
      findings.push({
        file: relativeFile,
        line: start,
        endLine: end,
        symbol: getFunctionName(node),
        value: lines,
        threshold,
      });
    }
  });
  return findings;
}

export function analyzeFileLength(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const lines = sourceFile.getEndLineNumber();
  if (lines > threshold) {
    return [{ file: relativeFile, line: 1, endLine: lines, value: lines, threshold }];
  }
  return [];
}
