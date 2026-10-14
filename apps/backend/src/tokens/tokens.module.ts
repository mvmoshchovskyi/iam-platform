import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthCookieService } from './auth-cookie.service';
import { TokenService } from './token.service';

@Global()
@Module({
  // Secrets/options are passed per call: access, refresh and 2FA tokens each use their own key
  imports: [JwtModule.register({})],
  providers: [TokenService, AuthCookieService],
  exports: [TokenService, AuthCookieService],
})
export class TokensModule {}
