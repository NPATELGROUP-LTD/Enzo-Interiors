import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto';

/**
 * The CRM client book.
 *
 * Staff-only at the route level (@Roles on the class): a Client principal has
 * no business listing the client book at all. Within staff, which rows come
 * back is decided by AccessService, so a Designer sees only their assigned
 * clients here without any per-handler role checks.
 */
@Controller('clients')
@Roles('Admin', 'Designer', 'Installer')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.clients.list(principal);
  }

  @Get(':id')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.clients.findOne(principal, id);
  }

  /** Aggregate feed for the Client Detail tabs. */
  @Get(':id/detail')
  detail(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.clients.detail(principal, id);
  }

  /** Creating a client account is an Admin action. */
  @Post()
  @Roles('Admin')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateClientDto) {
    return this.clients.create(principal, dto);
  }

  /** Assigned staff may maintain their own clients' details. */
  @Put(':id')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.update(principal, id, dto);
  }

  /** Destructive, and refuses while projects/quotes/invoices still reference the client. */
  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.clients.remove(principal, id);
  }
}
