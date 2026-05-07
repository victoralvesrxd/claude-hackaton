import { Node } from 'ts-morph';

export function getFunctionName(node: Node): string {
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
