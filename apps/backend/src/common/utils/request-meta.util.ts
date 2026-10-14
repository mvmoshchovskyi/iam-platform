import type { Request } from 'express';

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export const getRequestMeta = (req: Request): RequestMeta => ({
  ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});
