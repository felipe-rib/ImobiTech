import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HttpError } from './domain.js';

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export type DocumentType = 'application/pdf' | 'image/jpeg' | 'image/png';
const extension: Record<DocumentType, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};
export function validateDocument(bytes: Buffer, declared: string): DocumentType {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES)
    throw new HttpError(413, 'O documento deve ter até 5 MB.');
  const actual: DocumentType | undefined =
    bytes.subarray(0, 5).toString() === '%PDF-'
      ? 'application/pdf'
      : bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        ? 'image/jpeg'
        : bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
          ? 'image/png'
          : undefined;
  if (!actual || actual !== declared) throw new HttpError(400, 'Envie PDF, JPEG ou PNG válido.');
  return actual;
}
export class LocalDocumentStorage {
  constructor(private readonly directory: string) {}
  private path(key: string) {
    if (!/^[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(key)) throw new Error('Chave inválida.');
    return resolve(this.directory, key);
  }
  async save(bytes: Buffer, type: DocumentType) {
    const key = `${randomUUID()}${extension[type]}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.path(key), bytes, { flag: 'wx', mode: 0o600 });
    return key;
  }
  read(key: string) {
    return readFile(this.path(key));
  }
  async remove(key: string) {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
