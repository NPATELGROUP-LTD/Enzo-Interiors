import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { PasswordConfirmDto } from '../auth/reauth';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto';

/**
 * The CRM client book.
 *
 * Every route names its roles: Admin, plus Designer and Installer where they
 * may look. Editors and client tokens never get in. Which rows a Designer or
 * Installer reaches is AccessService's call (clients of projects assigned to
 * them). Only an Admin writes; a Designer asks one (/change-requests).
 */
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @Roles('Admin', 'Designer', 'Installer')
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.clients.list(principal);
  }

  @Get(':id')
  @Roles('Admin', 'Designer', 'Installer')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.clients.findOne(principal, id);
  }

  /** Aggregate feed for the Client Detail tabs. */
  @Get(':id/detail')
  @Roles('Admin', 'Designer', 'Installer')
  detail(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.clients.detail(principal, id);
  }

  @Post()
  @Roles('Admin')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateClientDto) {
    return this.clients.create(principal, dto);
  }

  @Put(':id')
  @Roles('Admin')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.update(principal, id, dto);
  }

  /** Asks every client to accept the portal terms again (their next visit shows the window). */
  @Post('terms/reset')
  @Roles('Admin')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  resetAllTerms(@CurrentUser() principal: AuthPrincipal) {
    return this.clients.resetTerms(principal);
  }

  /** Asks this client to accept the portal terms again. */
  @Post(':id/terms/reset')
  @Roles('Admin')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 15 * 60_000 } })
  resetTerms(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.clients.resetTerms(principal, id);
  }

  /** Emails a one-time link to choose a portal password. Also how an invitation is resent. */
  @Post(':id/invite')
  @Roles('Admin')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  invite(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.clients.invite(principal, id);
  }

  /** Deletes the client with all their records; needs `password` (the Admin's own). */
  @Delete(':id')
  @Roles('Admin')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: PasswordConfirmDto) {
    return this.clients.remove(principal, id, dto.password);
  }
}
