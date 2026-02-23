import crypto from 'node:crypto';
import { AppConfig } from '../config';

interface AdminSessionPayload {
  sub: 'admin';
  iat: number;
  exp: number;
}

export class AdminAuthService {
  private readonly sessionTtlSeconds = 12 * 60 * 60;

  constructor(private readonly config: AppConfig) {}

  isEnabled(): boolean {
    return Boolean(this.config.adminPassword);
  }

  verifyPassword(input: string): boolean {
    if (!this.config.adminPassword) return false;
    const a = Buffer.from(input);
    const b = Buffer.from(this.config.adminPassword);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  issueSessionToken(now = new Date()): string {
    const iat = Math.floor(now.getTime() / 1000);
    const payload: AdminSessionPayload = {
      sub: 'admin',
      iat,
      exp: iat + this.sessionTtlSeconds,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = this.sign(body);
    return `${body}.${sig}`;
  }

  verifySessionToken(token: string | undefined | null, now = new Date()): boolean {
    if (!token) return false;
    const [body, sig] = token.split('.');
    if (!body || !sig) return false;
    const expected = this.sign(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AdminSessionPayload;
      if (payload.sub !== 'admin') return false;
      const nowSec = Math.floor(now.getTime() / 1000);
      if (payload.exp <= nowSec) return false;
      return true;
    } catch {
      return false;
    }
  }

  private sign(body: string): string {
    return crypto.createHmac('sha256', this.config.adminSessionSecret).update(body).digest('base64url');
  }
}
