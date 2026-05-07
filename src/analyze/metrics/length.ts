import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
];

function getFunctionName(node: Node): string {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    return node.getName() ?? '<anonymous>';
  }
  if (Node.isConstructorDeclaration(node)) return 'constructor';
  if (Node.isGetAccessorDeclaration(node)) return `get ${node.getName()}`;
  if (Node.isSetAccessorDeclaration(node)) return `set ${node.getName()}`;
  if (Node.isFunctionExpression(node)) return node.getName() ?? '<function expression>';
  if (Node.isArrowFunction(node)) {
    const parent = node.getParent();
    if (parent && Node.isVariableDeclaration(parent)) return parent.getName();
    return '<arrow>';
  }
  return '<unknown>';
}

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
