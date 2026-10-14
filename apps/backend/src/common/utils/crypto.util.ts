import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** URL-safe random token (default 32 bytes → 43 chars). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

const ALGO = 'aes-256-gcm';

/** AES-256-GCM encryption; output format: base64(iv).base64(tag).base64(ciphertext) */
export const encrypt = (plain: string, base64Key: string): string => {
  const key = Buffer.from(base64Key, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString('base64')).join('.');
};

export const decrypt = (payload: string, base64Key: string): string => {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv(ALGO, Buffer.from(base64Key, 'base64'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};
