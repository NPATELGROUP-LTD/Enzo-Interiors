"use client";

// Standalone character-roll hover text. Each glyph carries two stacked
// copies (current + incoming) that swap places on a vertical axis; hovering
// staggers the swap left-to-right so the whole word "rolls" at once.
// Adapted from the Skiper UI TextRoll pattern (skiper58) for reuse anywhere
// in the site — nav links, buttons, list items — independent of its
// original navigation-menu context.
//
// Each letter's `animate` target is computed directly from a single
// `active` boolean in this component's own scope rather than relying on
// Framer Motion's variant-string propagation through the intervening plain
// <div>s, which does not reliably reach nested children here.
import { motion } from "motion/react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

const STAGGER = 0.025;

// The outgoing row and the incoming row differ only in where each glyph
// travels to. Declared at module scope, not inside TextRoll: a component
// redefined per render is a new type every render, so React would remount
// these spans and the roll would restart from scratch on every hover.
function Row({
  letters,
  to,
  incoming,
}: {
  letters: string[];
  to: string | number;
  incoming?: boolean;
}) {
  return (
    <div
      className={cn("flex select-none", incoming && "absolute inset-0")}
      aria-hidden={incoming || undefined}
    >
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          animate={{ y: to }}
          transition={{ ease: [0.4, 0, 0.2, 1], delay: STAGGER * i, duration: 0.35 }}
          className="inline-block"
        >
          {letter === " " ? " " : letter}
        </motion.span>
      ))}
    </div>
  );
}

interface TextRollProps {
  children: string;
  className?: string;
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

export const TextRoll: React.FC<TextRollProps> = ({ children, className, hovered }) => {
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
      <Row letters={letters} to={active ? "-100%" : 0} />
      <Row letters={letters} to={active ? 0 : "100%"} incoming />
    </span>
  );
};
