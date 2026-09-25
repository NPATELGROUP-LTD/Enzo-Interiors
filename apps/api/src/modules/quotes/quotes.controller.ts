import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Put } from '@nestjs/common';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import {
  ConvertToInvoiceDto,
  CreateQuoteDto,
  EstimateDto,
  QuoteDecisionDto,
  UpdateQuoteDto,
} from './dto';
import { QuotesService } from './quotes.service';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  /**
   * Public quote calculator for apps/web. No auth: it runs on a marketing page
   * before anyone has an account, which is exactly why it is careful to persist
   * nothing and read no client data.
   */
  @Public()
  @Post('estimate')
  @HttpCode(200)
  estimate(@Body() dto: EstimateDto) {
    return this.quotes.estimate(dto);
  }

  /** Staff see their scoped clients' quotes; a client sees only their own. */
  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.quotes.list(principal);
  }

  @Get(':id')
  findOne(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.quotes.findOne(principal, id);
  }

  @Post()
  @Roles('Admin', 'Designer')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateQuoteDto) {
    return this.quotes.create(principal, dto);
  }

  @Put(':id')
  @Roles('Admin', 'Designer')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.quotes.update(principal, id, dto);
  }

  @Post(':id/send')
  @Roles('Admin', 'Designer')
  @HttpCode(200)
  send(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.quotes.send(principal, id);
  }

  /* ---- Client decisions, from the portal's My Quotes screen ---- */

  @Post(':id/accept')
  @Roles('Client')
  @HttpCode(200)
  accept(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.quotes.accept(principal, id);
  }

  @Post(':id/decline')
  @Roles('Client')
  @HttpCode(200)
  decline(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: QuoteDecisionDto,
  ) {
    return this.quotes.decline(principal, id, dto);
  }

  @Post(':id/request-revision')
  @Roles('Client')
  @HttpCode(200)
  requestRevision(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: QuoteDecisionDto,
  ) {
    return this.quotes.requestRevision(principal, id, dto);
  }

  /* ---- Quote-to-invoice handoff ---- */

  @Post(':id/convert-to-invoice')
  @Roles('Admin')
  @HttpCode(201)
  convert(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ConvertToInvoiceDto,
  ) {
    return this.quotes.convertToInvoice(principal, id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.quotes.remove(principal, id);
  }
}

@Module({
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
