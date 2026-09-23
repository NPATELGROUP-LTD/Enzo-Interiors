import { Body, Controller, Get, HttpCode, Ip, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { AuthService, LoginResult } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Staff login. The client portal's /auth/portal/login returns with the portal. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: FIFTEEN_MINUTES } })
  @Post('admin/login')
  @HttpCode(200)
  loginAdmin(@Body() dto: LoginDto, @Ip() ip: string): Promise<LoginResult> {
    return this.auth.loginStaff(dto.email, dto.password, ip);
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
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.new_password);
  }

  /**
   * Who the bearer token says I am. Fresh from the database: the guard
   * re-reads the account on every request.
   */
  @Get('me')
  me(@CurrentUser() principal: AuthPrincipal): AuthPrincipal {
    return principal;
  }

  /** Returns a new token: the old one, like every other session, is now void. */
  @Put('password')
  @Roles('Admin', 'Designer', 'Installer')
  changePassword(@CurrentUser() principal: AuthPrincipal, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(principal, dto.current_password, dto.new_password);
  }
}
