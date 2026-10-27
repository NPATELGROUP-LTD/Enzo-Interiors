import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { PasswordConfirmDto } from '../auth/reauth';
import { NotificationsModule } from '../notifications/notifications.module';
import { CreateInvoiceDto, InvoiceDownloadDto, InvoicesService, UpdateInvoiceDto } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  /** Admin: all invoices. Client: their own, never Drafts. View and status only, no payment. */
  @Get()
  @Roles('Admin', 'Client')
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.invoices.list(principal);
  }

  @Get('summary')
  @Roles('Admin', 'Client')
  summary(@CurrentUser() principal: AuthPrincipal) {
    return this.invoices.summary(principal);
  }

  /** Admin: up to 200 invoices in full (`?ids=a,b,c`), for one print run / PDF. */
  @Get('export')
  @Roles('Admin')
  export(@Query('ids') ids?: string | string[]) {
    return this.invoices.export(ids);
  }

  @Get(':id')
  @Roles('Admin', 'Client')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.invoices.findOne(principal, id);
  }

  @Post()
  @Roles('Admin')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(principal, dto);
  }

  @Put(':id')
  @Roles('Admin')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoices.update(principal, id, dto);
  }

  /** Whether the portal lets the client save or print this invoice (view-only by default). */
  @Patch(':id/client-download')
  @Roles('Admin')
  setClientDownload(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: InvoiceDownloadDto) {
    return this.invoices.setClientDownload(principal, id, dto);
  }

  /**
   * The manual, Admin-only record of payment received externally.
   * Deliberately not reachable by a Designer, an Editor, or a Client.
   */
  @Put(':id/mark-paid')
  @Roles('Admin')
  @HttpCode(200)
  markPaid(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.invoices.markPaid(principal, id);
  }

  /** A Paid one needs `password` (the Admin's own) in the body. */
  @Delete(':id')
  @Roles('Admin')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: PasswordConfirmDto) {
    return this.invoices.remove(principal, id, dto.password);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
