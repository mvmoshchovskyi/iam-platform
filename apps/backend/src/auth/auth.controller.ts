import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApiProblem } from '../common/decorators/api-problem.decorator';
import { Public } from '../common/decorators/public.decorator';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { getRequestMeta } from '../common/utils/request-meta.util';
import { AuthService } from './auth.service';
import { EmailDto, VerifyEmailDto } from './dto/email-token.dto';
import { RegisterDto } from './dto/register.dto';

const MINUTE = 60_000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: MINUTE } })
  @ApiOperation({ summary: 'Sign up with email and password; sends a verification email' })
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiProblem(400, 429)
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<MessageResponseDto> {
    return this.auth.register(dto, getRequestMeta(req));
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @ApiOperation({ summary: 'Confirm an email address with the token from the email link' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiProblem(400, 409)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request): Promise<MessageResponseDto> {
    const { email } = await this.auth.verifyEmail(dto.token, getRequestMeta(req));
    return { message: `Email ${email} verified` };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: MINUTE } })
  @ApiOperation({ summary: 'Re-send the verification email' })
  @ApiAcceptedResponse({ type: MessageResponseDto })
  @ApiProblem(429)
  resendVerification(@Body() dto: EmailDto): Promise<MessageResponseDto> {
    return this.auth.resendVerification(dto.email);
  }
}
