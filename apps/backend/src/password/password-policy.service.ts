import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import * as zxcvbnEn from '@zxcvbn-ts/language-en';
import * as bcrypt from 'bcryptjs';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';

export const MIN_PASSWORD_SCORE = 3;

/** Hashing, strength validation (zxcvbn) and reuse prevention (password history). */
@Injectable()
export class PasswordPolicyService {
  private readonly zxcvbn = new ZxcvbnFactory({
    dictionary: { ...zxcvbnCommon.dictionary, ...zxcvbnEn.dictionary },
    graphs: zxcvbnCommon.adjacencyGraphs,
    translations: zxcvbnEn.translations,
  });

  // Pre-computed hash compared against when the user doesn't exist, so login timing
  // doesn't reveal whether an account exists.
  private readonly dummyHash = bcrypt.hashSync('timing-attack-mitigation', 10);

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.security.bcryptRounds);
  }

  compare(password: string, hash: string | null | undefined): Promise<boolean> {
    return bcrypt.compare(password, hash ?? this.dummyHash);
  }

  /** Rejects weak passwords; user-specific inputs (email, name) are penalised. */
  assertStrong(password: string, userInputs: (string | null | undefined)[] = []): void {
    const inputs = userInputs.filter((v): v is string => Boolean(v));
    // Penalise the whole value, the email local part and each word in it
    const variants = inputs.flatMap((v) => [v, v.split('@')[0], ...v.split(/[@.\s_-]/)]);
    const result = this.zxcvbn.check(
      password,
      [...new Set(variants)].filter((v) => v.length > 1),
    );
    if (result.score < MIN_PASSWORD_SCORE) {
      throw new BadRequestException({
        message: result.feedback.warning || 'Password is too weak',
        code: 'WEAK_PASSWORD',
        errors: [
          {
            field: 'password',
            messages: [result.feedback.warning, ...result.feedback.suggestions].filter(Boolean),
          },
        ],
      });
    }
  }

  /** Rejects a password matching any of the last N stored hashes. */
  async assertNotReused(userId: string, password: string): Promise<void> {
    const depth = this.config.security.passwordHistoryDepth;
    if (depth === 0) return;
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: depth,
      select: { passwordHash: true },
    });
    for (const { passwordHash } of history) {
      if (await bcrypt.compare(password, passwordHash)) {
        throw new BadRequestException({
          message: `New password must differ from your last ${depth} passwords`,
          code: 'PASSWORD_REUSED',
        });
      }
    }
  }

  /** Appends a hash to the history and trims it to the configured depth. */
  async recordHistory(
    tx: Prisma.TransactionClient,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await tx.passwordHistory.create({ data: { userId, passwordHash } });
    const keep = await tx.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(this.config.security.passwordHistoryDepth, 1),
      select: { id: true },
    });
    await tx.passwordHistory.deleteMany({
      where: { userId, id: { notIn: keep.map((h) => h.id) } },
    });
  }
}
