import { SourceFile } from 'ts-morph';
import type { Finding } from '../../types.js';

const TODO_PATTERN = /\b(TODO|FIXME|XXX)\b/;

export function analyzeTodos(sourceFile: SourceFile, relativeFile: string): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    const ranges = [
      ...node.getLeadingCommentRanges(),
      ...node.getTrailingCommentRanges(),
    ];
    for (const range of ranges) {
      const text = range.getText();
      if (TODO_PATTERN.test(text)) {
        const line = sourceFile.getLineAndColumnAtPos(range.getPos()).line;
        findings.push({
          file: relativeFile,
          line,
          value: 1,
          threshold: 0,
        });
      }
    }
  });
  // De-duplicate by file:line because both leading and trailing iteration may pick up the same comment.
  const dedup = new Map<string, Finding>();
  for (const f of findings) dedup.set(`${f.file}:${f.line}`, f);
  return [...dedup.values()];
}
