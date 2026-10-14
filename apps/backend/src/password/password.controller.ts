import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { EmailDto } from '../auth/dto/email-token.dto';
import { ApiProblem } from '../common/decorators/api-problem.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import type { AuthUser } from '../common/types/auth-user';
import { getRequestMeta } from '../common/utils/request-meta.util';
import { ChangePasswordDto, ChangePasswordResponseDto, ResetPasswordDto } from './dto/password.dto';
import { PasswordService } from './password.service';

const MINUTE = 60_000;

@ApiTags('Password')
@Controller('auth')
export class PasswordController {
  constructor(private readonly passwords: PasswordService) {}

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password (other sessions are signed out per security policy)' })
  @ApiOkResponse({ type: ChangePasswordResponseDto })
  @ApiProblem(400, 401, 429)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<ChangePasswordResponseDto> {
    return this.passwords.changePassword(user, dto, getRequestMeta(req));
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: MINUTE } })
  @ApiOperation({ summary: 'Email a password reset link' })
  @ApiAcceptedResponse({ type: MessageResponseDto })
  @ApiProblem(400, 429)
  forgotPassword(@Body() dto: EmailDto, @Req() req: Request): Promise<MessageResponseDto> {
    return this.passwords.forgotPassword(dto.email, getRequestMeta(req));
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiOperation({ summary: 'Set a new password using the emailed token (signs out all sessions)' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiProblem(400, 429)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request): Promise<MessageResponseDto> {
    return this.passwords.resetPassword(dto, getRequestMeta(req));
  }
}
