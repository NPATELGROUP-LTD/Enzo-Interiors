import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { STAFF_ROLES } from '../../common/types/domain';
import { ClientIp } from '../../core/client-ip';
import { AuthPrincipal } from '../../common/types/principal';
import { AuthService, LoginResult, Me } from './auth.service';
import { ChallengeCodeDto, ChallengeDto, ChangePasswordDto, CodeDto, ForgotPasswordDto, LoginDto, PortalResetDto, ProfileDto, ResetPasswordDto } from './dto';
import { DeviceView, TwoFactorService, TwoFactorStep } from './two-factor';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  /** Client portal login: `{ access_token, user }`. No second step for clients yet. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('portal/login')
  @HttpCode(200)
  loginPortal(@Body() dto: LoginDto, @ClientIp() ip: string): Promise<LoginResult> {
    return this.auth.portalLogin(dto.email, dto.password, ip);
  }

  /** Always 204, client or not. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: FIFTEEN_MINUTES } })
  @Post('portal/forgot')
  @HttpCode(204)
  async forgotPortal(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.forgotPortalPassword(dto.email);
  }

  /** Sets the password from an invitation or a reset link; signs every portal session out. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: FIFTEEN_MINUTES } })
  @Post('portal/reset')
  @HttpCode(204)
  async resetPortal(@Body() dto: PortalResetDto, @ClientIp() ip: string): Promise<void> {
    await this.auth.resetPortalPassword(dto.token, dto.new_password, ip);
  }

  /**
   * Staff login: a session, or `{ twoFactor, challenge }` when a code is
   * needed next (two-factor.ts).
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('admin/login')
  @HttpCode(200)
  async loginAdmin(@Body() dto: LoginDto, @ClientIp() ip: string): Promise<LoginResult | TwoFactorStep> {
    const staff = await this.auth.checkPassword(dto.email, dto.password, ip);
    return this.twoFactor.begin(staff, ip, dto.deviceToken);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('admin/verify-code')
  @HttpCode(200)
  verifyCode(@Body() dto: CodeDto, @ClientIp() ip: string, @Headers('user-agent') ua?: string): Promise<LoginResult> {
    return this.twoFactor.verify(dto.challenge, dto.code, ip, dto.remember, ua);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: FIFTEEN_MINUTES } })
  @Post('admin/resend-code')
  @HttpCode(200)
  resendCode(@Body() dto: ChallengeDto) {
    return this.twoFactor.resend(dto.challenge);
  }

  /* ---- Choosing a method at the first sign-in (the challenge, not a session) ---- */

  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('admin/enrol/email/start')
  @HttpCode(200)
  enrolEmailStart(@Body() dto: ChallengeDto) {
    return this.twoFactor.enrolEmailStart(dto.challenge);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('admin/enrol/email/confirm')
  @HttpCode(200)
  enrolEmailConfirm(@Body() dto: CodeDto, @ClientIp() ip: string, @Headers('user-agent') ua?: string): Promise<LoginResult> {
    return this.twoFactor.enrolEmailConfirm(dto.challenge, dto.code, ip, dto.remember, ua);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('admin/enrol/totp/start')
  @HttpCode(200)
  enrolAppStart(@Body() dto: ChallengeDto) {
    return this.twoFactor.enrolAppStart(dto.challenge);
  }

  /** The emailed code from start, for the app's secret (shown as a QR code). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('admin/enrol/totp/secret')
  @HttpCode(200)
  enrolAppSecret(@Body() dto: ChallengeCodeDto, @ClientIp() ip: string) {
    return this.twoFactor.enrolAppSecret(dto.challenge, dto.code, ip);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('admin/enrol/totp/confirm')
  @HttpCode(200)
  enrolAppConfirm(@Body() dto: CodeDto, @ClientIp() ip: string, @Headers('user-agent') ua?: string): Promise<LoginResult> {
    return this.twoFactor.enrolAppConfirm(dto.challenge, dto.code, ip, dto.remember, ua);
  }

  /** Always 204, account or not. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: FIFTEEN_MINUTES } })
  @Post('admin/forgot-password')
  @HttpCode(204)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: FIFTEEN_MINUTES } })
  @Post('admin/reset-password')
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordDto, @ClientIp() ip: string): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.new_password, ip);
  }

  /**
   * Who the bearer token says I am. Fresh from the database: the guard
   * re-reads the account on every request. Staff and portal clients alike.
   */
  @Get('me')
  @Roles(...STAFF_ROLES, 'Client')
  me(@CurrentUser() principal: AuthPrincipal): Promise<Me> {
    return this.auth.me(principal);
  }

  /** Browsers that skip the code. Logging out leaves them; this is how to forget one. */
  @Get('devices')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  devices(@CurrentUser() principal: AuthPrincipal): Promise<DeviceView[]> {
    return this.twoFactor.devices(principal);
  }

  @Delete('devices/:id')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async forgetDevice(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.twoFactor.forgetDevice(principal, id);
  }

  /** Returns a new token: the old one, like every other session, is now void. */
  @Put('password')
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Roles('Admin', 'Editor', 'Designer', 'Installer')
  changePassword(@CurrentUser() principal: AuthPrincipal, @Body() dto: ChangePasswordDto, @ClientIp() ip: string) {
    return this.auth.changePassword(principal, dto.current_password, dto.new_password, ip);
  }

  @Put('profile')
  @Roles('Admin', 'Editor', 'Designer', 'Installer')
  updateProfile(@CurrentUser() principal: AuthPrincipal, @Body() dto: ProfileDto) {
    return this.auth.updateProfile(principal, dto.name);
  }
}
