"use client";

// The page's single magnetic control. Deliberately used once — on the
// closing invitation — because a magnetic pull reads as "this is *the*
// thing to press", and that only works if nothing else on the page does it.
//
// The shell and the label move at different rates so the button has a
// little internal depth rather than sliding around as one rigid block, and
// the pull is clamped well inside the hit box so the pointer never ends up
// chasing a control that has slid out from under it.
import { useRef, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";
import { useGSAP } from "@/hooks/useGSAP";
import { cn } from "@/lib/utils";

const PULL = 0.32;
const LABEL_PULL = 0.14;

export function MagneticButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(rootRef, (root, reduced) => {
    if (reduced) return;

    const shell = root.querySelector<HTMLElement>("[data-magnet-shell]");
    const label = root.querySelector<HTMLElement>("[data-magnet-label]");
    if (!shell || !label) return;

    const config = { duration: 0.5, ease: "elastic.out(1, 0.55)" } as const;
    const shellX = gsap.quickTo(shell, "x", config);
    const shellY = gsap.quickTo(shell, "y", config);
    const labelX = gsap.quickTo(label, "x", config);
    const labelY = gsap.quickTo(label, "y", config);

    const onMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const dx = event.clientX - rect.left - rect.width / 2;
      const dy = event.clientY - rect.top - rect.height / 2;
      shellX(dx * PULL);
      shellY(dy * PULL);
      labelX(dx * LABEL_PULL);
      labelY(dy * LABEL_PULL);
    };

    const onLeave = () => {
      shellX(0);
      shellY(0);
      labelX(0);
      labelY(0);
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    // Keyboard users never fire pointermove, so make sure focus/blur can't
    // leave the shell parked at a stale offset either.
    root.addEventListener("focusout", onLeave);

    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("focusout", onLeave);
    };
  });

  return (
    // Padding gives the magnet a catchment area larger than the pill, so
    // the pull starts before the pointer is already on the target.
    <div ref={rootRef} className={cn("inline-block p-5", className)}>
      <Link
        href={href}
        data-magnet-shell
        data-cursor="view"
        className="group/magnet inline-flex items-center gap-3 rounded-full bg-enzo-cream py-4 pl-8 pr-4 text-enzo-forest transition-colors duration-300 will-change-transform hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
      >
        <span
          data-magnet-label
          className="whitespace-nowrap text-[14px] font-medium tracking-[0.01em] will-change-transform"
        >
          {children}
        </span>
        <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-enzo-forest text-enzo-cream">
          <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover/magnet:translate-x-6" />
          <ArrowRight className="absolute h-4 w-4 -translate-x-6 transition-transform duration-300 ease-out group-hover/magnet:translate-x-0" />
        </span>
      </Link>
    </div>
  );
}
