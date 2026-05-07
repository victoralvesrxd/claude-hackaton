import { Node, SourceFile, SyntaxKind } from 'ts-morph';
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

const BRANCH_KINDS = new Set<SyntaxKind>([
  SyntaxKind.IfStatement,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.CatchClause,
]);

export function calculateComplexity(node: Node): number {
  let score = 1;
  node.forEachDescendant((d) => {
    const kind = d.getKind();
    if (BRANCH_KINDS.has(kind)) {
      score++;
      return;
    }
    if (kind === SyntaxKind.BinaryExpression) {
      const opKind = d.asKind(SyntaxKind.BinaryExpression)?.getOperatorToken().getKind();
      if (
        opKind === SyntaxKind.AmpersandAmpersandToken ||
        opKind === SyntaxKind.BarBarToken ||
        opKind === SyntaxKind.QuestionQuestionToken
      ) {
        score++;
      }
    }
  });
  return score;
}

export function analyzeComplexity(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!FUNCTION_KINDS.includes(node.getKind())) return;
    const score = calculateComplexity(node);
    if (score > threshold) {
      findings.push({
        file: relativeFile,
        line: node.getStartLineNumber(),
        endLine: node.getEndLineNumber(),
        symbol: getFunctionName(node),
        value: score,
        threshold,
      });
    }
  });
  return findings;
}
