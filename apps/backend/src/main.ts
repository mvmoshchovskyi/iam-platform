import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  configureApp(app);
  setupSwagger(app);

  const config = app.get(AppConfigService);
  await app.listen(config.app.port);
  app
    .get(Logger)
    .log(
      `API listening on http://localhost:${config.app.port}/${config.app.apiPrefix} (docs: /${config.app.apiPrefix}/docs)`,
    );
}

void bootstrap();
