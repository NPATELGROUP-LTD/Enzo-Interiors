import { useRef, useEffect, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface ScrollFXSection {
  leftLabel: string;
  title?: ReactNode;
  rightLabel: string;
  background: string;
}

interface FullScreenScrollFXProps {
  sections: ScrollFXSection[];
  centerContent?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  showProgress?: boolean;
  durations?: { change?: number; snap?: number };
}

export function FullScreenScrollFX({
  sections,
  centerContent,
  header,
  footer,
  showProgress = true,
  durations = { change: 0.7, snap: 800 },
}: FullScreenScrollFXProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Preload images
  useEffect(() => {
    let loaded = 0;
    const total = sections.length;
    sections.forEach((section) => {
      const img = new Image();
      img.src = section.background;
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= total) setImagesLoaded(true);
      };
    });
    // Fallback: mark loaded after 3s even if images haven't loaded
    const fallback = setTimeout(() => setImagesLoaded(true), 3000);
    return () => clearTimeout(fallback);
  }, [sections]);

  useEffect(() => {
    if (!containerRef.current || !imagesLoaded) return;

    const ctx = gsap.context(() => {
      const totalSections = sections.length;
      // The container height determines the scrollable range
      // Each section gets 100vh of scroll distance
      const trigger = ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: `+=${totalSections * 100}%`,
        pin: true,
        scrub: 0.5,
        snap: {
          snapTo: 1 / (totalSections - 1),
          duration: { min: 0.3, max: (durations.snap ?? 800) / 1000 },
          ease: "power2.inOut",
        },
        onUpdate: (self) => {
          const progress = self.progress;
          const newIndex = Math.round(progress * (totalSections - 1));
          setActiveIndex(Math.min(newIndex, totalSections - 1));
        },
      });

      return () => {
        trigger.kill();
      };
    }, containerRef);

    return () => ctx.revert();
  }, [sections.length, imagesLoaded, durations.snap]);

  const currentSection = sections[activeIndex];
  const changeDuration = durations.change ?? 0.7;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden"
    >
      {/* Background images - crossfade */}
      <div className="absolute inset-0">
        <AnimatePresence mode="sync">
          <motion.div
            key={activeIndex}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: changeDuration, ease: "easeInOut" }}
          >
            <img
              src={currentSection.background}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/30" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Header overlay */}
      {header && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center pt-24 md:pt-28 pointer-events-none">
          <div className="pointer-events-auto">{header}</div>
        </div>
      )}

      {/* Left label */}
      <div className="absolute left-6 md:left-12 top-1/2 -translate-y-1/2 z-10 hidden lg:flex items-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={`left-${activeIndex}`}
            className="text-[#F2F0EB]/70 text-[14px] uppercase tracking-[0.3em]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.4 }}
          >
            {currentSection.leftLabel}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Right label */}
      <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 z-10 hidden lg:flex items-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={`right-${activeIndex}`}
            className="text-[#F2F0EB]/70 font-[Cormorant_Garamond] text-[15px]"
            style={{ writingMode: "vertical-rl" }}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.4 }}
          >
            {currentSection.rightLabel}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Center title — static when centerContent provided, per-slide otherwise */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
        {centerContent ? (
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            {centerContent}
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`title-${activeIndex}`}
              className="text-center"
              initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -40, filter: "blur(8px)" }}
              transition={{ duration: changeDuration * 0.8, ease: "easeOut" }}
            >
              {currentSection.title}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Progress indicator */}
      {showProgress && (
        <div className="absolute bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 md:gap-3">
          {sections.map((_, i) => (
            <button
              key={i}
              className="relative w-8 md:w-10 h-[2px] rounded-full overflow-hidden bg-white/20 transition-all duration-300"
              aria-label={`Go to section ${i + 1}`}
            >
              <motion.div
                className="absolute inset-y-0 left-0 bg-[#F2F0EB] rounded-full"
                animate={{
                  width:
                    i === activeIndex
                      ? "100%"
                      : i < activeIndex
                        ? "100%"
                        : "0%",
                }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
            </button>
          ))}
          <span className="ml-2 md:ml-3 text-[#F2F0EB]/70 text-[13px] md:text-[15px] font-[Cormorant_Garamond]">
            {String(activeIndex + 1).padStart(2, "0")} /{" "}
            {String(sections.length).padStart(2, "0")}
          </span>
        </div>
      )}

      {/* Footer overlay */}
      {footer && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center pb-6 pointer-events-none">
          <div className="pointer-events-auto">{footer}</div>
        </div>
      )}

      {/* Scroll hint */}
      <motion.div
        className="absolute bottom-8 right-6 md:right-12 z-20 hidden lg:flex items-center gap-2"
        animate={{ opacity: activeIndex === 0 ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-[1px] h-8 bg-[#F2F0EB]/30 relative overflow-hidden">
          <motion.div
            className="w-full bg-[#F2F0EB]/80 absolute top-0"
            animate={{
              height: ["0%", "100%", "0%"],
              top: ["0%", "0%", "100%"],
            }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </div>
        <span className="text-[#F2F0EB]/40 text-[10px] uppercase tracking-[0.2em]">
          Scroll
        </span>
      </motion.div>
    </div>
  );
}
