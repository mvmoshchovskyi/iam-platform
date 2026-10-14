import type { Request } from 'express';

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

/** "::ffff:203.0.113.7" (IPv4-mapped IPv6, as reported by dual-stack sockets) → "203.0.113.7" */
const normalizeIp = (ip: string | undefined): string | null =>
  ip ? ip.replace(/^::ffff:/, '') : null;

export const getRequestMeta = (req: Request): RequestMeta => ({
  ipAddress: normalizeIp(req.ip ?? req.socket?.remoteAddress),
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});
