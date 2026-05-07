import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
];

function getFunctionName(node: Node): string {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    return node.getName() ?? '<anonymous>';
  }
  if (Node.isConstructorDeclaration(node)) return 'constructor';
  if (Node.isFunctionExpression(node)) return node.getName() ?? '<function expression>';
  if (Node.isArrowFunction(node)) {
    const parent = node.getParent();
    if (parent && Node.isVariableDeclaration(parent)) return parent.getName();
    return '<arrow>';
  }
  return '<unknown>';
}

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
