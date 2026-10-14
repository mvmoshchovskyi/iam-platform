import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiProblem } from '../common/decorators/api-problem.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { getRequestMeta } from '../common/utils/request-meta.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@ApiProblem(401)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile with roles and permissions' })
  @ApiOkResponse({ type: UserProfileDto })
  me(@CurrentUser() user: AuthUser): Promise<UserProfileDto> {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (email change requires re-verification)' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiProblem(400, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ): Promise<UserProfileDto> {
    return this.users.updateProfile(user.id, dto, getRequestMeta(req));
  }
}
