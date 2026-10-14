import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PasswordModule } from '../password/password.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './guards/csrf.guard';
import { LoginProtectionService } from './login-protection.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, UsersModule, PasswordModule],
  controllers: [AuthController],
  providers: [AuthService, LoginProtectionService, JwtStrategy, CsrfGuard],
  exports: [AuthService, LoginProtectionService],
})
export class AuthModule {}
