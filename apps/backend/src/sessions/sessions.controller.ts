import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiProblem } from '../common/decorators/api-problem.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { getRequestMeta } from '../common/utils/request-meta.util';
import { RevokedSessionsDto, SessionDto } from './dto/session.dto';
import { SessionsService } from './sessions.service';

@ApiTags('Sessions')
@ApiBearerAuth('access-token')
@ApiProblem(401)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'List active sessions of the current user' })
  @ApiOkResponse({ type: [SessionDto] })
  list(@CurrentUser() user: AuthUser): Promise<SessionDto[]> {
    return this.sessions.listForUser(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one of your sessions' })
  @ApiNoContentResponse()
  @ApiProblem(404)
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.sessions.revokeOwn(user, id, getRequestMeta(req));
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions except the current one' })
  @ApiOkResponse({ type: RevokedSessionsDto })
  revokeOthers(@CurrentUser() user: AuthUser, @Req() req: Request): Promise<RevokedSessionsDto> {
    return this.sessions.revokeOthers(user, getRequestMeta(req));
  }
}
