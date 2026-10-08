import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { CLIENT_STATUSES, ClientStatus } from '../../common/types/domain';

/**
 * No password field, on create or update: nobody sets a client's password for
 * them. Portal access is POST /clients/:id/invite, which emails the client a
 * link to choose their own.
 */
export class CreateClientDto {
  @IsString()
  @MinLength(2, { message: 'Enter the client’s name' })
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email!: string;

  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsOptional() @IsIn(CLIENT_STATUSES, { message: 'Status must be Active or Inactive' }) status?: ClientStatus;
  @IsOptional() @IsString() assigned_staff_id?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
}

/**
 * A Designer may send only phone, address and notes (ClientsService.update);
 * the rest is the Admin's.
 */
export class UpdateClientDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsOptional() @IsIn(CLIENT_STATUSES) status?: ClientStatus;
  @IsOptional() @IsString() assigned_staff_id?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;

  /**
   * Admin override for the lifetime-value figure shown on the client record.
   * Normally derived from paid invoices; exposed because the founder may need
   * to carry over a historical figure from before the platform existed.
   */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) total_spent?: number;
}
