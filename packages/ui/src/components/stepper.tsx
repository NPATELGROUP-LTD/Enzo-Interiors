import * as React from 'react';
import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '../lib/utils';

export interface StepperStep {
  id: string | number;
  label: React.ReactNode;
  status: 'complete' | 'current' | 'upcoming';
}

export interface StepperProps extends Omit<React.ComponentProps<'ol'>, 'children'> {
  steps: StepperStep[];
}

const circleClass: Record<StepperStep['status'], string> = {
  complete: 'bg-primary text-primary-foreground',
  current: 'bg-primary text-primary-foreground',
  upcoming: 'bg-muted text-muted-foreground',
};

/**
 * Horizontal multi-step progress — the 5-step booking wizard.
 *
 * Used by: apps/web (Booking Wizard: Service → Date → Time → Contact →
 * Confirmation).
 * Variants: none — controlled entirely by `steps[].status`, set by the
 * consumer as the wizard advances. Below `sm`, collapses to a compact
 * "Step X of Y" label instead of the full horizontal rail (five circles
 * don't fit a 375px viewport legibly).
 * A11y: renders as an `<ol>`; the current step's circle animates in via
 * `motion`, respecting `prefers-reduced-motion` through `useReducedMotion`
 * (the global CSS rule in tokens.css only covers CSS transitions/
 * animations, not Framer Motion's JS-driven ones — this is the one place
 * in the library that needs the explicit opt-out).
 * Brief v6 deviations: none — new composition, not ported.
 */
function Stepper({ steps, className, ...props }: StepperProps) {
  const shouldReduceMotion = useReducedMotion();
  const currentIndex = steps.findIndex((s) => s.status === 'current');

  return (
    <>
      <ol data-slot="stepper" className={cn('hidden sm:flex sm:items-center', className)} {...props}>
        {steps.map((step, index) => (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <motion.span
                animate={step.status === 'current' && !shouldReduceMotion ? { scale: [1, 1.08, 1] } : undefined}
                transition={{ duration: 0.4 }}
                className={cn('flex size-8 items-center justify-center rounded-full text-sm font-semibold', circleClass[step.status])}
              >
                {step.status === 'complete' ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </motion.span>
              <span className={cn('text-[13px] font-medium', step.status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground')}>{step.label}</span>
            </div>
            {index < steps.length - 1 ? (
              <div className={cn('mx-2 h-px flex-1', step.status === 'complete' ? 'bg-primary' : 'bg-border')} aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="text-[13px] font-medium text-muted-foreground sm:hidden" role="status">
        Step {Math.max(currentIndex, 0) + 1} of {steps.length}: {steps[Math.max(currentIndex, 0)]?.label}
      </p>
    </>
  );
}

export { Stepper };
