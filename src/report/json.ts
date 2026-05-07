import { writeFile } from 'node:fs/promises';
import type { Report } from '../types.js';

export async function writeJsonReport(report: Report, outPath: string): Promise<void> {
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
}
