import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';

const SAMPLE_BYTES = 8192;

export async function isBinary(filePath: string): Promise<boolean> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(SAMPLE_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, SAMPLE_BYTES, 0);
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return true;
    }
    return false;
  } finally {
    await handle.close();
  }
}

export async function countLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    let lastByte = -1;
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: string | Buffer) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0x0a) count++;
        lastByte = buf[i] ?? lastByte;
      }
    });
    stream.on('end', () => {
      // If file is non-empty and does not end with newline, count the final partial line.
      if (lastByte !== -1 && lastByte !== 0x0a) count++;
      resolve(count);
    });
    stream.on('error', reject);
  });
}
