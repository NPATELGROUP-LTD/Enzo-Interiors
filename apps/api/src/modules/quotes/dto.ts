import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  QUOTE_STATUSES,
  QUOTE_TYPES,
  SERVICE_TYPES,
  QuoteStatus,
  QuoteType,
  ServiceType,
} from '../../common/types/domain';

/** The three Investment Guide tiers from the Service Detail page. */
export const ESTIMATE_TIERS = ['Essential', 'Premium', 'Luxury'] as const;
export type EstimateTier = (typeof ESTIMATE_TIERS)[number];

export class QuoteLineInput {
  @IsString() component_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Quantity must be a number' })
  @Min(0.01, { message: 'Quantity must be greater than zero' })
  quantity!: number;
}

export class CreateQuoteDto {
  @IsString() client_id!: string;

  @IsIn(SERVICE_TYPES, { message: `Service must be one of: ${SERVICE_TYPES.join(', ')}` })
  service_id!: ServiceType;

  @IsIn(QUOTE_TYPES, { message: 'Quote type must be Simple or Detailed' })
  type!: QuoteType;

  /** The 2D/3D design fee, priced separately per PRD 5.2. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  design_fee?: number;

  /** Detailed quotes only. Each line snapshots its component's current price. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineInput)
  lines?: QuoteLineInput[];

  /**
   * Simple quotes only: the indicative net figure, typically carried over from
   * the website calculator.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsIn(QUOTE_STATUSES)
  status?: QuoteStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  vat_rate?: number;
}

export class UpdateQuoteDto {
  @IsOptional() @IsIn(SERVICE_TYPES) service_id?: ServiceType;
  @IsOptional() @IsIn(QUOTE_TYPES) type?: QuoteType;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) design_fee?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) subtotal?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) vat_rate?: number;
  @IsOptional() @IsIn(QUOTE_STATUSES) status?: QuoteStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineInput)
  lines?: QuoteLineInput[];
}

/** POST /quotes/estimate — public, called by the website calculator. */
export class EstimateDto {
  @IsIn(SERVICE_TYPES, { message: `Service must be one of: ${SERVICE_TYPES.join(', ')}` })
  service_id!: ServiceType;

  @IsIn(ESTIMATE_TIERS, { message: 'Tier must be Essential, Premium or Luxury' })
  tier!: EstimateTier;

  /** Approximate room size in m². Optional; the tier alone yields a default. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1, { message: 'Room size must be at least 1 m²' })
  size_sqm?: number;

  /** Whether the 3D design package is included in the estimate. */
  @IsOptional()
  include_design_package?: boolean;
}

/** Client-side quote decisions from the portal. */
export class QuoteDecisionDto {
  @IsOptional()
  @IsString()
  /** Free-text reason, shown to staff on the quote. Used by decline/revision. */
  note?: string;
}

export class ConvertToInvoiceDto {
  /** Optional project to attach the resulting invoice to. */
  @IsOptional() @IsString() project_id?: string | null;

  /** Days until the invoice is due. Defaults to the business's 30-day terms. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) due_in_days?: number;
}
