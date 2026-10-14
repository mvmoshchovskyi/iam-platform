import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { AppConfigService } from './config/app-config.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logger/logger.module';
import { MailModule } from './mail/mail.module';
import { REDIS_CLIENT } from './redis/redis.constants';
import { PermissionsGuard } from './rbac/guards/permissions.guard';
import { RolesGuard } from './rbac/guards/roles.guard';
import { RedisModule } from './redis/redis.module';
import { TokensModule } from './tokens/tokens.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    RedisModule,
    MailModule,
    AuditModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService, REDIS_CLIENT],
      useFactory: (config: AppConfigService, redis: Redis) => ({
        throttlers: [
          {
            name: 'default',
            ttl: seconds(config.throttle.ttlSeconds),
            limit: config.throttle.limit,
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
        // e2e suites hammer auth endpoints; brute-force protection is tested separately
        skipIf: () => config.app.isTest,
      }),
    }),
    HealthModule,
    TokensModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    // Order matters: rate limit → authenticate → role check → permission check
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
