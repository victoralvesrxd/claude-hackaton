export type ErrorKind = 'fatal' | 'file' | 'parse';

export class ScannerError extends Error {
  readonly kind: ErrorKind;
  readonly file?: string;

  constructor(kind: ErrorKind, message: string, file?: string) {
    super(message);
    this.name = 'ScannerError';
    this.kind = kind;
    this.file = file;
  }
}
