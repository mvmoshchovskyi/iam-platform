import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { type Paginated, paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import type { AuditLogDto, AuditLogQueryDto } from './dto/admin-audit.dto';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditLogQueryDto): Promise<Paginated<AuditLogDto>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.userId && { OR: [{ userId: query.userId }, { actorId: query.userId }] }),
      ...(query.action && { action: query.action }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
    };
    const userRef = { select: { id: true, email: true } };
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: userRef, actor: userRef },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(
      logs.map(({ userId: _u, actorId: _a, ...log }) => log),
      total,
      query,
    );
  }
}
