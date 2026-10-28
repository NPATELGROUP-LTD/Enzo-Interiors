import { IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

import { TEAM_ROLES, TeamRole } from '../../common/types/domain';

/** `YYYY-MM-DD`; the service also rejects 2026-02-31. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'Dates look like 2026-11-03';

/** POST /projects/:id/team — Admin. The person must hold that role in Settings › Users. */
export class AddMemberDto {
  @IsString() @MaxLength(64) staff_id!: string;
  @IsIn(TEAM_ROLES) role!: TeamRole;
}

/** PUT /projects/:id/team/:memberId/installation — Admin. Send null to clear a field. */
export class InstallationDto {
  @IsOptional() @Matches(DAY, { message: DAY_MESSAGE }) start_date?: string | null;
  @IsOptional() @Matches(DAY, { message: DAY_MESSAGE }) end_date?: string | null;
  /** Pounds, two decimals. Stored as a decimal, never a float. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999.99) pay?: number | null;
  @IsOptional() @IsString() @MaxLength(500) pay_note?: string | null;
}

/**
 * POST .../pay — the installer. `pay` is the amount on their screen: if the Admin
 * changed it since, the answer is refused (409) rather than approving an amount
 * they never saw.
 */
export class PayDecisionDto {
  @IsIn(['approved', 'declined']) decision!: 'approved' | 'declined';
  @IsNumber({ maxDecimalPlaces: 2 }) pay!: number;
}

/** POST .../dates/approve — the installer, with the dates on their screen (same 409 rule as the pay). */
export class ApproveDatesDto {
  @Matches(DAY, { message: DAY_MESSAGE }) start_date!: string;
  @Matches(DAY, { message: DAY_MESSAGE }) end_date!: string;
}

/** POST .../dates/suggest — the installer. */
export class SuggestDatesDto {
  @Matches(DAY, { message: DAY_MESSAGE }) start_date!: string;
  @Matches(DAY, { message: DAY_MESSAGE }) end_date!: string;
  @IsString() @MinLength(1, { message: 'Say why these dates suit you better' }) @MaxLength(1000) comment!: string;
}

/** POST .../suggestion — Admin. */
export class SuggestionDecisionDto {
  @IsIn(['accept', 'decline']) decision!: 'accept' | 'decline';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
