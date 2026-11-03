import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HttpError } from '../shared/domain.js';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PROPERTY_PHOTOS = 10;
export type PhotoType = 'image/jpeg' | 'image/png' | 'image/webp';

const extensions: Record<PhotoType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function validatePhoto(bytes: Buffer, contentType: string): PhotoType {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES)
    throw new HttpError(413, 'A foto deve ter até 5 MB.');
  const actual: PhotoType | undefined =
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? 'image/jpeg'
      : bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
        ? 'image/png'
        : bytes.length >= 12 &&
            bytes.toString('ascii', 0, 4) === 'RIFF' &&
            bytes.toString('ascii', 8, 12) === 'WEBP'
          ? 'image/webp'
          : undefined;
  if (!actual || actual !== contentType)
    throw new HttpError(400, 'Envie uma imagem JPEG, PNG ou WebP válida.');
  return actual;
}

// The API depends on this narrow interface; a future bucket adapter can replace it.
export interface PhotoStorage {
  save(bytes: Buffer, type: PhotoType): Promise<string>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export class LocalPhotoStorage implements PhotoStorage {
  constructor(private readonly directory: string) {}

  private path(key: string) {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) throw new Error('Chave inválida.');
    return resolve(this.directory, key);
  }

  async save(bytes: Buffer, type: PhotoType) {
    const key = `${randomUUID()}${extensions[type]}`;
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
