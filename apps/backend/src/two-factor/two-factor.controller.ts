import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { sendSession } from '../auth/session-response';
import { ApiProblem } from '../common/decorators/api-problem.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { getRequestMeta } from '../common/utils/request-meta.util';
import { AuthCookieService } from '../tokens/auth-cookie.service';
import {
  DisableTwoFactorDto,
  RecoveryCodesDto,
  TotpCodeDto,
  TwoFactorSetupDto,
  VerifyTwoFactorDto,
} from './dto/two-factor.dto';
import { TwoFactorService } from './two-factor.service';

const MINUTE = 60_000;

@ApiTags('Two-Factor Auth')
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(
    private readonly twoFactor: TwoFactorService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Start 2FA setup: returns otpauth URL and QR code' })
  @ApiOkResponse({ type: TwoFactorSetupDto })
  @ApiProblem(401, 409)
  enable(@CurrentUser() user: AuthUser): Promise<TwoFactorSetupDto> {
    return this.twoFactor.enable(user.id);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Confirm setup with a TOTP code; returns one-time recovery codes' })
  @ApiOkResponse({ type: RecoveryCodesDto })
  @ApiProblem(400, 401, 429)
  confirm(
    @CurrentUser() user: AuthUser,
    @Body() dto: TotpCodeDto,
    @Req() req: Request,
  ): Promise<RecoveryCodesDto> {
    return this.twoFactor.confirm(user.id, dto.code, getRequestMeta(req));
  }

  @Post('disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable 2FA (requires current password)' })
  @ApiNoContentResponse()
  @ApiProblem(400, 401, 429)
  disable(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableTwoFactorDto,
    @Req() req: Request,
  ): Promise<void> {
    return this.twoFactor.disable(user.id, dto.password, getRequestMeta(req));
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiOperation({ summary: 'Complete sign-in with a TOTP or recovery code' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiProblem(400, 401, 423, 429)
  async verify(
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return sendSession(
      this.cookies,
      res,
      await this.twoFactor.verifyLogin(dto, getRequestMeta(req)),
    );
  }
}
