import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ApiProblem } from '../common/decorators/api-problem.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import type { AuthUser } from '../common/types/auth-user';
import { getRequestMeta } from '../common/utils/request-meta.util';
import { AuthCookieService } from '../tokens/auth-cookie.service';
import { AuthService } from './auth.service';
import { AuthResponseDto, LoginResponseDto } from './dto/auth-response.dto';
import { EmailDto, VerifyEmailDto } from './dto/email-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CsrfGuard } from './guards/csrf.guard';
import { sendSession } from './session-response';

const MINUTE = 60_000;

class LogoutAllResponseDto {
  @ApiProperty({ example: 3 })
  revokedSessions: number;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

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

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Returns an access token and sets the refresh token as an HttpOnly cookie. If 2FA is enabled, ' +
      'returns `{ requiresTwoFactor: true, twoFactorToken }` instead — complete with POST /auth/2fa/verify.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiProblem(400, 401, 403, 423, 429)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.auth.login(dto, getRequestMeta(req));
    if (result.requiresTwoFactor) return result;
    return sendSession(this.cookies, res, result);
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: MINUTE } })
  @ApiCookieAuth('refresh-cookie')
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Value of the csrf_token cookie',
  })
  @ApiOperation({ summary: 'Rotate the refresh token cookie and get a new access token' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiProblem(401, 403)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const raw = this.cookies.getRefreshToken(req);
    if (!raw)
      throw new UnauthorizedException({ message: 'No active session', code: 'NO_REFRESH_TOKEN' });
    try {
      return sendSession(this.cookies, res, await this.auth.refresh(raw, getRequestMeta(req)));
    } catch (err) {
      this.cookies.clearSessionCookies(res);
      throw err;
    }
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('refresh-cookie')
  @ApiHeader({
    name: 'X-CSRF-Token',
    required: true,
    description: 'Value of the csrf_token cookie',
  })
  @ApiOperation({ summary: 'Revoke the current session and clear cookies' })
  @ApiNoContentResponse()
  @ApiProblem(403)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.cookies.getRefreshToken(req), getRequestMeta(req));
    this.cookies.clearSessionCookies(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke every session of the current user (all devices)' })
  @ApiOkResponse({ type: LogoutAllResponseDto })
  @ApiProblem(401)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutAllResponseDto> {
    const result = await this.auth.logoutAll(user.id, getRequestMeta(req));
    this.cookies.clearSessionCookies(res);
    return result;
  }
}
