import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { CLIENT_STATUSES, ClientStatus } from '../../common/types/domain';

export class CreateClientDto {
  @IsString()
  @MinLength(2, { message: 'Enter the client’s name' })
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsIn(CLIENT_STATUSES, { message: 'Status must be Active or Inactive' })
  status?: ClientStatus;

  @IsOptional()
  @IsString()
  assigned_staff_id?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  /**
   * Portal password for the new client. Optional — when omitted the client
   * record exists in the CRM but cannot log in yet, which matches how a lead
   * is usually captured before portal access is granted.
   *
   * MOCK ONLY: stored as plaintext, see StaffUser.password_hash.
   */
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;
}

export class UpdateClientDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address' }) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsIn(CLIENT_STATUSES) status?: ClientStatus;
  @IsOptional() @IsString() assigned_staff_id?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() @MinLength(6) password?: string;

  /**
   * Admin override for the lifetime-value figure shown on the client record.
   * Normally derived from paid invoices; exposed because the founder may need
   * to carry over a historical figure from before the platform existed.
   */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) total_spent?: number;
}
