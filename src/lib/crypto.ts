import crypto from 'node:crypto';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function hashPasswordScrypt(password: string, pepper: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(`${password}${pepper}`, salt, 32);
  return `scrypt_v1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPasswordScrypt(password: string, pepper: string, encoded: string): boolean {
  const [algo, saltHex, hashHex] = String(encoded ?? '').split('$');
  if (algo !== 'scrypt_v1' || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = crypto.scryptSync(`${password}${pepper}`, salt, 32).toString('hex');
  return timingSafeEqualHex(expected, hashHex);
}
