"use client";

// Standalone character-roll hover text. Each glyph carries two stacked
// copies (current + incoming) that swap places on a vertical axis; hovering
// staggers the swap outward from the center so the whole word "rolls" at
// once. Adapted from the Skiper UI TextRoll pattern (skiper58) for reuse
// anywhere in the site — nav links, buttons, list items — independent of
// its original navigation-menu context.
//
// Each letter's `animate` target is computed directly from a single
// `active` boolean in this component's own scope (rather than relying on
// Framer Motion's variant-string propagation through the intervening plain
// <div>s) — that propagation path turned out not to reliably reach nested
// children here, so driving every letter explicitly is the robust option.
import { motion } from "motion/react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

const STAGGER = 0.025;

export interface TextRollProps {
  children: string;
  className?: string;
  /** Stagger the roll outward from the center instead of left-to-right. */
  center?: boolean;
  /**
   * Controls the roll from outside instead of the element's own hover
   * state. Use this when a larger ancestor (e.g. a nav link's full padded
   * hit area) should trigger the animation — relying on this component's
   * own hover tracking only fires once the pointer is directly over the
   * glyphs themselves, which is too small a target in practice. Omit to
   * fall back to self-contained hover behavior.
   */
  hovered?: boolean;
}

export const TextRoll: React.FC<TextRollProps> = ({
  children,
  className,
  center = false,
  hovered,
}) => {
  const [selfHovered, setSelfHovered] = useState(false);
  const isControlled = hovered !== undefined;
  const active = isControlled ? hovered : selfHovered;
  const letters = children.split("");

  return (
    <span
      onMouseEnter={isControlled ? undefined : () => setSelfHovered(true)}
      onMouseLeave={isControlled ? undefined : () => setSelfHovered(false)}
      className={cn("relative inline-block overflow-hidden", className)}
      style={{ lineHeight: 1 }}
    >
      <div className="flex select-none">
        {letters.map((letter, i) => {
          const delay = center
            ? STAGGER * Math.abs(i - (letters.length - 1) / 2)
            : STAGGER * i;

          return (
            <motion.span
              animate={{ y: active ? "-100%" : 0 }}
              transition={{ ease: [0.4, 0, 0.2, 1], delay, duration: 0.35 }}
              className="inline-block"
              key={i}
            >
              {letter === " " ? "\u00A0" : letter}
            </motion.span>
          );
        })}
      </div>
      <div className="absolute inset-0 flex select-none" aria-hidden="true">
        {letters.map((letter, i) => {
          const delay = center
            ? STAGGER * Math.abs(i - (letters.length - 1) / 2)
            : STAGGER * i;

          return (
            <motion.span
              animate={{ y: active ? 0 : "100%" }}
              transition={{ ease: [0.4, 0, 0.2, 1], delay, duration: 0.35 }}
              className="inline-block"
              key={i}
            >
              {letter === " " ? "\u00A0" : letter}
            </motion.span>
          );
        })}
      </div>
    </span>
  );
};
