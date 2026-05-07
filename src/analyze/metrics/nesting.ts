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

const NESTING_KINDS = new Set<SyntaxKind>([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.TryStatement,
  SyntaxKind.CatchClause,
]);

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

function maxDepth(node: Node, current = 0): number {
  let max = current;
  node.forEachChild((child) => {
    const childDepth = NESTING_KINDS.has(child.getKind()) ? current + 1 : current;
    const childMax = maxDepth(child, childDepth);
    if (childMax > max) max = childMax;
  });
  return max;
}

export function analyzeNesting(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!FUNCTION_KINDS.includes(node.getKind())) return;
    const depth = maxDepth(node, 0);
    if (depth > threshold) {
      findings.push({
        file: relativeFile,
        line: node.getStartLineNumber(),
        endLine: node.getEndLineNumber(),
        symbol: getFunctionName(node),
        value: depth,
        threshold,
      });
    }
  });
  return findings;
}
