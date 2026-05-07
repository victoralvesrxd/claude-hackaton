import path from 'node:path';
import { createRequire } from 'node:module';
import type { DuplicationFinding } from '../types.js';

interface JscpdTokenLocation {
  line: number;
  column?: number;
  position?: number;
}

interface JscpdDuplication {
  sourceId: string;
  start: JscpdTokenLocation;
  end: JscpdTokenLocation;
  range?: [number, number];
  fragment?: string;
}

interface JscpdClone {
  format: string;
  duplicationA: JscpdDuplication;
  duplicationB: JscpdDuplication;
}

type DetectClones = (opts: object) => Promise<JscpdClone[]>;

// jscpd 4.0.x ships an ESM build that imports `colors/safe` without a file
// extension, which Node's strict ESM resolver rejects. Loading the CJS build
// via createRequire sidesteps the broken ESM resolution while keeping the rest
// of the codebase ESM.
const requireFromHere = createRequire(import.meta.url);

export async function runDuplicationScan(rootDir: string): Promise<DuplicationFinding[]> {
  let detect: DetectClones | undefined;
  try {
    const jscpdMod = requireFromHere('jscpd') as {
      detectClones?: DetectClones;
      jscpd?: DetectClones;
    };
    detect = jscpdMod.detectClones ?? jscpdMod.jscpd;
  } catch {
    return [];
  }
  if (typeof detect !== 'function') return [];

  let clones: JscpdClone[];
  try {
    clones = await detect({
      path: [rootDir],
      silent: true,
      format: ['typescript', 'tsx', 'javascript', 'jsx'],
      reporters: [],
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
      ],
      minTokens: 50,
      minLines: 5,
      gitignore: false,
    });
  } catch {
    // jscpd can throw on edge-case inputs; treat as no findings rather than crashing
    // the whole scan.
    return [];
  }

  if (!Array.isArray(clones)) return [];

  return clones.map((c) => ({
    tokens: 0,
    occurrences: [
      {
        file: path.relative(rootDir, c.duplicationA.sourceId),
        startLine: c.duplicationA.start.line,
        endLine: c.duplicationA.end.line,
      },
      {
        file: path.relative(rootDir, c.duplicationB.sourceId),
        startLine: c.duplicationB.start.line,
        endLine: c.duplicationB.end.line,
      },
    ],
  }));
}
