import { Module } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminRolesService } from './admin-roles.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [UsersModule, SessionsModule],
  controllers: [AdminController],
  providers: [AdminUsersService, AdminRolesService, AdminAuditService],
})
export class AdminModule {}
