import { useState, useEffect } from "react";
import { AnimatePresence, motion, LayoutGroup } from "motion/react";

interface TextRotateProps {
  texts: string[];
  rotationInterval?: number;
  mainClassName?: string;
  splitLevelClassName?: string;
  staggerFrom?: "first" | "last" | "center";
  staggerDuration?: number;
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
  transition?: Record<string, unknown>;
  /* Legacy API compat */
  words?: string[];
  interval?: number;
  className?: string;
}

export function TextRotate({
  texts,
  rotationInterval = 2500,
  mainClassName = "",
  splitLevelClassName = "",
  staggerFrom = "last",
  staggerDuration = 0.025,
  initial = { y: "100%" },
  animate = { y: 0 },
  exit = { y: "-120%" },
  transition = { type: "spring", damping: 30, stiffness: 400 },
  /* Legacy compat */
  words,
  interval,
  className = "",
}: TextRotateProps) {
  // Support legacy API
  const allTexts = texts ?? words ?? [];
  const effectiveInterval = rotationInterval ?? interval ?? 2500;

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (allTexts.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % allTexts.length);
    }, effectiveInterval);
    return () => clearInterval(timer);
  }, [allTexts.length, effectiveInterval]);

  const currentText = allTexts[index] || "";
  const chars = currentText.split("");

  const getStaggerDelay = (charIndex: number, total: number) => {
    if (staggerFrom === "last") return (total - 1 - charIndex) * staggerDuration;
    if (staggerFrom === "center") return Math.abs(charIndex - Math.floor(total / 2)) * staggerDuration;
    return charIndex * staggerDuration;
  };

  return (
    <span className={`inline-flex ${className}`}>
      <LayoutGroup>
        <motion.span
          className="inline-flex whitespace-pre"
          layout
          transition={{ type: "spring", damping: 30, stiffness: 400 }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={currentText}
              className={`inline-flex overflow-hidden ${mainClassName}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {chars.map((char, i) => (
                <motion.span
                  key={`${currentText}-${i}`}
                  className={`inline-block overflow-hidden ${splitLevelClassName}`}
                >
                  <motion.span
                    className="inline-block"
                    initial={initial}
                    animate={animate}
                    exit={exit}
                    transition={{
                      ...transition,
                      delay: getStaggerDelay(i, chars.length),
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                </motion.span>
              ))}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </LayoutGroup>
    </span>
  );
}
