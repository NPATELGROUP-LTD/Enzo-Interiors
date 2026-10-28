import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

import { InvoiceStage } from '../../common/types/domain';
import { pennies } from './totals';

/**
 * Payment stages: an invoice paid in instalments ("On start" 50%, "On installation"
 * 40%, "On completion" 10%). A stage is a percentage of the gross payable or a
 * fixed £ amount. The invoice is Paid only when every stage is (invoice-store).
 */
const D = Prisma.Decimal;

export const MAX_STAGES = 6;

/** What a new invoice starts with in the admin form; the API itself adds none unless asked. */
export const DEFAULT_STAGES: StageDto[] = [
  { label: 'On start', mode: 'percent', value: 50 },
  { label: 'On installation', mode: 'percent', value: 40 },
  { label: 'On completion', mode: 'percent', value: 10 },
];

export class StageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @MinLength(1, { message: 'Name each payment stage' }) @MaxLength(60) label!: string;

  @IsIn(['percent', 'fixed'], { message: 'A stage is a percentage or a fixed amount' }) mode!: 'percent' | 'fixed';

  /** Percent of the gross payable, or £. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Stage values must have at most 2 decimal places' })
  @Min(0.01, { message: 'A stage must be more than zero' }) @Max(9_999_999.99)
  value!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsOptional() @IsString() @MaxLength(120) due_note?: string | null;
}

export class StagePaidDto {
  /** YYYY-MM-DD the money arrived; defaults to today. */
  @IsOptional() @IsString() @MaxLength(10) paid_at?: string;
}

/**
 * The £ amount of each stage, in order. Each stage is rounded to the penny and
 * the last one takes the remainder, so they always sum exactly to `gross`. A mix
 * whose percentages and £ amounts do not add up to the whole (beyond that
 * rounding) is refused, so a stage list can never leave money unaccounted for.
 */
export function stageAmounts(gross: number, stages: Array<Pick<StageDto, 'mode' | 'value'>>): number[] {
  if (stages.length === 0) return [];
  const total = new D(gross);
  if (total.lte(0)) throw new BadRequestException('Payment stages need an invoice total above £0.');

  let nominal = new D(0);
  let percentStages = 0;
  const amounts = stages.map(({ mode, value }) => {
    if (mode === 'percent' && value > 100) throw new BadRequestException('A stage cannot be more than 100%.');
    const exact = mode === 'percent' ? total.mul(value).div(100) : new D(value);
    if (mode === 'percent') percentStages++;
    nominal = nominal.add(exact);
    return pennies(exact);
  });
  // Each percentage stage is off by at most half a penny from rounding; anything more is a real gap.
  if (nominal.sub(total).abs().gt(new D('0.005').mul(percentStages))) {
    throw new BadRequestException(
      `The stages add up to £${pennies(nominal).toFixed(2)} but the invoice total is £${total.toFixed(2)}. Adjust a stage so they match.`,
    );
  }
  const last = stages.length - 1;
  amounts[last] = total.sub(amounts.slice(0, last).reduce((sum, amount) => sum.add(amount), new D(0)));
  if (amounts.some((amount) => amount.lt('0.01'))) {
    throw new BadRequestException('Each stage must work out to at least £0.01. Adjust the stages.');
  }
  return amounts.map((amount) => amount.toNumber());
}

/** The rows to store for an invoice: positions in order, amounts worked out, nothing paid. */
export function stageRows(
  gross: number,
  stages: Array<Pick<StageDto, 'label' | 'mode' | 'value' | 'due_note'>>,
): Array<Omit<InvoiceStage, 'id' | 'invoice_id'>> {
  const amounts = stageAmounts(gross, stages);
  return stages.map(({ label, mode, value, due_note }, position) => ({
    position,
    label,
    mode,
    value,
    amount: amounts[position]!,
    due_note: due_note ?? null,
    paid_at: null,
    paid_by: null,
  }));
}
