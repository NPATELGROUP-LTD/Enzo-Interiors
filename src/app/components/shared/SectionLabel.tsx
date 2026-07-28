interface SectionLabelProps {
  text: string;
  className?: string;
  light?: boolean;
}

export function SectionLabel({ text, className = "", light = false }: SectionLabelProps) {
  return (
    <div className={`flex items-center gap-4 justify-center ${className}`}>
      <div className={`h-px w-8 ${light ? "bg-[#8A9E8C]/40" : "bg-[#C4B8A8]"}`} />
      <span
        className={`text-[11px] uppercase tracking-[0.25em] ${
          light ? "text-[#8A9E8C]" : "text-[#8A9E8C]"
        }`}
      >
        {text}
      </span>
      <div className={`h-px w-8 ${light ? "bg-[#8A9E8C]/40" : "bg-[#C4B8A8]"}`} />
    </div>
  );
}
