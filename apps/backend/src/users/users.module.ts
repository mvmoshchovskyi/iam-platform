import { Module } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, EmailVerificationService],
  exports: [UsersService, EmailVerificationService],
})
export class UsersModule {}
