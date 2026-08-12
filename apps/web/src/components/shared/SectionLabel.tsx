// Ported from Boilerplate:src/app/components/shared/SectionLabel.tsx.
// No hooks/browser APIs — stays a Server Component (no "use client").
// Original used raw arbitrary hex utilities (bg-[#C4B8A8], text-[#8A9E8C]);
// this port uses the design-token classes from src/styles/theme.css instead.
interface SectionLabelProps {
  text: string;
  className?: string;
  light?: boolean;
}

export function SectionLabel({
  text,
  className = "",
  light = false,
}: SectionLabelProps) {
  return (
    <div className={`flex items-center gap-4 justify-center ${className}`}>
      <div
        className={`h-px w-8 ${light ? "bg-enzo-sage/40" : "bg-border"}`}
      />
      <span className="text-[11px] uppercase tracking-[0.25em] text-secondary">
        {text}
      </span>
      <div
        className={`h-px w-8 ${light ? "bg-enzo-sage/40" : "bg-border"}`}
      />
    </div>
  );
}
