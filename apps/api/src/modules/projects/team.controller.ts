import { Body, Controller, Delete, HttpCode, Param, Post, Put } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { AddMemberDto, ApproveDatesDto, InstallationDto, PayDecisionDto, SuggestDatesDto, SuggestionDecisionDto } from './team.dto';
import { TeamService } from './team.service';

/**
 * A project's designers and installers. Reading the team is part of
 * GET /projects/:id/detail; these routes change it. Admin sets the people, the
 * dates, the pay and when to send them; the installer answers their own sent
 * assignment (pay and dates separately, or other dates). Every route names its
 * role; a Designer, Editor, Infra manager or client gets 403, and an installer
 * reaching for anyone else's assignment, or their own before it is sent, a 404.
 * Each returns the team as the caller may see it.
 */
@Controller('projects/:id/team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Post()
  @Roles('Admin')
  add(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.team.add(principal, id, dto);
  }

  @Delete(':memberId')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Param('memberId') memberId: string) {
    return this.team.remove(principal, id, memberId);
  }

  @Put(':memberId/installation')
  @Roles('Admin')
  setTerms(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Param('memberId') memberId: string, @Body() dto: InstallationDto) {
    return this.team.setTerms(principal, id, memberId, dto);
  }

  @Post(':memberId/send')
  @Roles('Admin')
  @HttpCode(200)
  send(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Param('memberId') memberId: string) {
    return this.team.send(principal, id, memberId);
  }

  @Post(':memberId/suggestion')
  @Roles('Admin')
  @HttpCode(200)
  decideSuggestion(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: SuggestionDecisionDto,
  ) {
    return this.team.decideSuggestion(principal, id, memberId, dto);
  }

  @Post(':memberId/pay')
  @Roles('Installer')
  @HttpCode(200)
  decidePay(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Param('memberId') memberId: string, @Body() dto: PayDecisionDto) {
    return this.team.decidePay(principal, id, memberId, dto);
  }

  @Post(':memberId/dates/approve')
  @Roles('Installer')
  @HttpCode(200)
  approveDates(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Param('memberId') memberId: string, @Body() dto: ApproveDatesDto) {
    return this.team.approveDates(principal, id, memberId, dto);
  }

  @Post(':memberId/dates/suggest')
  @Roles('Installer')
  @HttpCode(200)
  suggestDates(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Param('memberId') memberId: string, @Body() dto: SuggestDatesDto) {
    return this.team.suggestDates(principal, id, memberId, dto);
  }
}
