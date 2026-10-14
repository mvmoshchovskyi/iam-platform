import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service';

/**
 * HTTP-level wiring shared by main.ts and the e2e test bootstrap so both run
 * with identical middleware, prefix and security headers.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);
  const prefix = config.app.apiPrefix;

  // Trust the first proxy hop (Vite dev proxy / load balancer) so req.ip is the client IP
  (app as NestExpressApplication).set('trust proxy', 1);
  app.setGlobalPrefix(prefix);

  const strictHelmet = helmet();
  // Swagger UI needs inline scripts/styles, so CSP is relaxed only on the docs route
  const docsHelmet = helmet({ contentSecurityPolicy: false });
  app.use((req: { path: string }, res: unknown, next: () => void) =>
    (req.path.startsWith(`/${prefix}/docs`) ? docsHelmet : strictHelmet)(
      req as never,
      res as never,
      next,
    ),
  );
  app.use(cookieParser());

  app.enableCors({
    origin: config.app.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['Retry-After', 'X-Request-Id'],
  });
}

export function setupSwagger(app: INestApplication): void {
  const prefix = app.get(AppConfigService).app.apiPrefix;
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('IAM Platform API')
      .setDescription(
        'Identity & Access Management API — authentication, 2FA, sessions, RBAC and audit. ' +
          'Errors follow RFC 7807 (application/problem+json).',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addCookieAuth('refresh_token', { type: 'apiKey', in: 'cookie' }, 'refresh-cookie')
      .build(),
  );
  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    jsonDocumentUrl: `${prefix}/docs/json`,
    swaggerOptions: { persistAuthorization: true, withCredentials: true },
  });
}
