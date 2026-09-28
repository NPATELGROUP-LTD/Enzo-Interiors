"use client";

// Controls shared by the planner, quick estimate and studio catalogue.
// Pill buttons and soft input wells follow the booking wizard and quote
// modal, so the tool reads as part of the same site.
import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Board } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "cream";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-enzo-forest-light focus-visible:ring-ring focus-visible:ring-offset-background",
  secondary:
    "border border-border bg-transparent text-foreground hover:border-primary focus-visible:ring-ring focus-visible:ring-offset-background",
  ghost: "text-foreground hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-background",
  danger:
    "border border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-destructive",
  cream:
    "bg-enzo-cream text-primary hover:bg-enzo-sand focus-visible:ring-enzo-sand focus-visible:ring-offset-enzo-forest",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-9 px-4 text-[13px]" : "h-11 px-6 text-[14px]",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export const buttonClass = (variant: Variant = "primary", size: "sm" | "md" = "md") =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    size === "sm" ? "h-9 px-4 text-[13px]" : "h-11 px-6 text-[14px]",
    VARIANTS[variant],
  );

export const inputClass =
  "w-full rounded-xl border border-border bg-input-background px-3.5 py-2.5 text-[14px] text-foreground transition-colors focus:border-primary focus:bg-white focus:outline-none";

export function Field({
  label,
  hint,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * A number field that lets you type freely and only commits on blur or
 * Enter, so clearing it to type "2400" does not clamp to the minimum on the
 * first keystroke.
 */
export function NumberInput({
  id,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  suffix,
  prefix,
  className,
  ariaLabel,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseFloat(draft);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      const stepped = step >= 1 ? Math.round(clamped) : clamped;
      if (stepped !== value) onChange(stepped);
    }
    setDraft(null);
  };
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="decimal"
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className={cn(inputClass, "font-display tabular-nums", suffix && "pr-12", prefix && "pl-7")}
      />
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[13px] text-muted-foreground">
          {prefix}
        </span>
      )}
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-input-background p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              value === option.value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-3 text-[14px]">
      <span className="relative inline-flex">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-10 rounded-full bg-border transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      {label}
    </label>
  );
}

/** A board's photo, or its swatch colour when it has none. */
export function Swatch({ board, className }: { board: Pick<Board, "swatch" | "image" | "name">; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-md border border-black/10 bg-cover bg-center", className)}
      style={{
        backgroundColor: board.swatch,
        backgroundImage: board.image ? `url(${board.image})` : undefined,
      }}
    />
  );
}
