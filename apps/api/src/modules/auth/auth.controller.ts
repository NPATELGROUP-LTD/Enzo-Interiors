import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';

import { CurrentUser, Public } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { AuthService, LoginResult } from './auth.service';
import { LoginDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Staff login. Separate issuer from the portal flow, per the architecture
   * doc — a token minted here is a Staff token and cannot be swapped for a
   * client session.
   */
  @Public()
  @Post('admin/login')
  @HttpCode(200)
  loginAdmin(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.loginStaff(dto.email, dto.password);
  }

  /** Client login. */
  @Public()
  @Post('portal/login')
  @HttpCode(200)
  loginPortal(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.loginClient(dto.email, dto.password);
  }

  /**
   * Who the bearer token says I am.
   *
   * Both frontends call this on boot to rehydrate a session from a stored
   * token, rather than trusting a user object cached in localStorage — the
   * server is the authority on the caller's role.
   */
  @Get('me')
  me(@CurrentUser() principal: AuthPrincipal): AuthPrincipal {
    return principal;
  }
}
