import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { RequestMeta } from '../common/utils/request-meta.util';
import type { AuditAction } from './audit-action';

export interface AuditEntry {
  action: AuditAction;
  userId?: string | null;
  actorId?: string | null;
  resource?: string;
  resourceId?: string;
  meta?: Partial<RequestMeta>;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Writes an audit record. Never throws — auditing must not break the request. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId ?? null,
          actorId: entry.actorId ?? entry.userId ?? null,
          resource: entry.resource,
          resourceId: entry.resourceId,
          ipAddress: entry.meta?.ipAddress ?? null,
          userAgent: entry.meta?.userAgent ?? null,
          metadata: entry.metadata,
        },
      });
    } catch (err) {
      this.logger.error({ err, action: entry.action }, 'Failed to write audit log');
    }
  }
}
