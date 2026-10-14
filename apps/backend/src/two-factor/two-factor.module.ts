import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PasswordModule } from '../password/password.module';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [AuthModule, PasswordModule],
  controllers: [TwoFactorController],
  providers: [TwoFactorService],
})
export class TwoFactorModule {}
