import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './configuration';

/** Typed facade over ConfigService so callers never deal with string keys. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  get app(): AppConfig['app'] {
    return this.config.get('app', { infer: true });
  }
  get database(): AppConfig['database'] {
    return this.config.get('database', { infer: true });
  }
  get redis(): AppConfig['redis'] {
    return this.config.get('redis', { infer: true });
  }
  get jwt(): AppConfig['jwt'] {
    return this.config.get('jwt', { infer: true });
  }
  get cookie(): AppConfig['cookie'] {
    return this.config.get('cookie', { infer: true });
  }
  get twoFactor(): AppConfig['twoFactor'] {
    return this.config.get('twoFactor', { infer: true });
  }
  get security(): AppConfig['security'] {
    return this.config.get('security', { infer: true });
  }
  get throttle(): AppConfig['throttle'] {
    return this.config.get('throttle', { infer: true });
  }
  get mail(): AppConfig['mail'] {
    return this.config.get('mail', { infer: true });
  }
}
