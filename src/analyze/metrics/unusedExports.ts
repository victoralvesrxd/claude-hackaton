import { Node, Project } from 'ts-morph';
import path from 'node:path';
import type { Finding } from '../../types.js';

export function analyzeUnusedExports(project: Project, rootDir: string): Finding[] {
  const findings: Finding[] = [];

  // With fewer than two source files, no external consumer is even possible,
  // so the metric is not meaningful — skip to avoid noisy findings on tiny
  // projects (e.g. a freshly scaffolded package with one entrypoint).
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length < 2) return findings;

  for (const sourceFile of sourceFiles) {
    const relativeFile = path.relative(rootDir, sourceFile.getFilePath());
    const exportedDeclarations = sourceFile.getExportedDeclarations();

    for (const [name, declarations] of exportedDeclarations) {
      let referencedExternally = false;
      for (const decl of declarations) {
        const refs = collectReferences(decl);
        for (const ref of refs) {
          const refFile = ref.getSourceFile();
          if (refFile !== sourceFile) {
            referencedExternally = true;
            break;
          }
        }
        if (referencedExternally) break;
      }
      if (!referencedExternally) {
        const decl = declarations[0];
        if (!decl) continue;
        findings.push({
          file: relativeFile,
          line: decl.getStartLineNumber(),
          symbol: name,
          value: 0,
          threshold: 0,
        });
      }
    }
  }

  return findings;
}

function collectReferences(node: Node): Node[] {
  // Identifier-bearing declarations expose findReferencesAsNodes via ts-morph.
  const anyNode = node as unknown as { findReferencesAsNodes?: () => Node[] };
  if (typeof anyNode.findReferencesAsNodes === 'function') {
    return anyNode.findReferencesAsNodes();
  }
  return [];
}
