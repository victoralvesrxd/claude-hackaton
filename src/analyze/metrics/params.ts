import { SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';
import { getFunctionName } from './functionName.js';

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
];

export function analyzeParams(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!FUNCTION_KINDS.includes(node.getKind())) return;
    const params = (node as unknown as { getParameters: () => unknown[] }).getParameters?.() ?? [];
    const count = params.length;
    if (count > threshold) {
      findings.push({
        file: relativeFile,
        line: node.getStartLineNumber(),
        endLine: node.getEndLineNumber(),
        symbol: getFunctionName(node),
        value: count,
        threshold,
      });
    }
  });
  return findings;
}
