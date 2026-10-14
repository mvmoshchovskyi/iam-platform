import { Module } from '@nestjs/common';
import { PasswordPolicyService } from './password-policy.service';
import { PasswordController } from './password.controller';
import { PasswordService } from './password.service';

@Module({
  controllers: [PasswordController],
  providers: [PasswordPolicyService, PasswordService],
  exports: [PasswordPolicyService],
})
export class PasswordModule {}
