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
 * Every route names its roles: Admin, plus Designer (and Installer, treated
 * the same) where they may look. Editors and client tokens never get in.
 * Which rows a Designer reaches is AccessService's call (clients of projects
 * assigned to them), and which fields they may write is ClientsService's.
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

  /** A Designer may change phone, address and notes of a client they can see. */
  @Put(':id')
  @Roles('Admin', 'Designer', 'Installer')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.update(principal, id, dto);
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
