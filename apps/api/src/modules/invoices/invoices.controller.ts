import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Put } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { CreateInvoiceDto, InvoicesService, UpdateInvoiceDto } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  /** Clients see their own invoices here — view and status only, no payment. */
  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.invoices.list(principal);
  }

  @Get('summary')
  summary(@CurrentUser() principal: AuthPrincipal) {
    return this.invoices.summary(principal);
  }

  @Get(':id')
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

  /**
   * The manual, Admin-only record of payment received externally.
   * Deliberately not reachable by a Designer, an Installer, or a Client.
   */
  @Put(':id/mark-paid')
  @Roles('Admin')
  @HttpCode(200)
  markPaid(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.invoices.markPaid(principal, id);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.invoices.remove(principal, id);
  }
}

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
