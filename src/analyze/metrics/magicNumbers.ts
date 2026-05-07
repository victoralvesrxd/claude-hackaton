import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';

const ALLOWED = new Set([-1, 0, 1, 2]);
const TEST_PATTERNS = [/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i, /(^|\/)__tests__\//i];

export function isTestFile(relativePath: string): boolean {
  return TEST_PATTERNS.some((re) => re.test(relativePath));
}

function literalNumericValue(node: Node): number | null {
  if (node.getKind() === SyntaxKind.NumericLiteral) {
    return Number(node.getText());
  }
  if (node.getKind() === SyntaxKind.PrefixUnaryExpression) {
    const pue = node.asKind(SyntaxKind.PrefixUnaryExpression);
    if (pue && pue.getOperatorToken() === SyntaxKind.MinusToken) {
      const operand = pue.getOperand();
      if (operand.getKind() === SyntaxKind.NumericLiteral) {
        return -Number(operand.getText());
      }
    }
  }
  return null;
}

export function analyzeMagicNumbers(sourceFile: SourceFile, relativeFile: string): Finding[] {
  if (isTestFile(relativeFile)) return [];
  const findings: Finding[] = [];
  const seen = new Set<Node>(); // skip the operand of a unary minus we've already counted
  sourceFile.forEachDescendant((node) => {
    if (seen.has(node)) return;
    const value = literalNumericValue(node);
    if (value === null || ALLOWED.has(value)) return;
    if (node.getKind() === SyntaxKind.PrefixUnaryExpression) {
      const operand = node.asKind(SyntaxKind.PrefixUnaryExpression)?.getOperand();
      if (operand) seen.add(operand);
    }
    findings.push({
      file: relativeFile,
      line: node.getStartLineNumber(),
      value,
      threshold: 0,
    });
  });
  return findings;
}
