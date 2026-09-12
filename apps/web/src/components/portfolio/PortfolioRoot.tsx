"use client";

// /portfolio — the one piece of client state the page has.
//
// Two sections can open a case study — the wall and §03's worked example —
// and there is one sheet. Rather than each of them owning a copy of "which
// project is open", the state lives here and the sections take an `onOpen`
// callback. That is also what makes the sheet's previous/next work: stepping
// is `index ± 1` over the same array every section was rendered from, so the
// order the visitor steps through is the order they were looking at.
//
// The page itself stays a Server Component — it fetches the records and
// hands them to this. Nothing below needs a fetch.
import { useCallback, useState } from "react";
import { CaseStudySheet } from "./CaseStudySheet";
import { PortfolioMasthead } from "./PortfolioMasthead";
import { PortfolioWall } from "./PortfolioWall";
import { PortfolioAnatomy } from "./PortfolioAnatomy";
import { PortfolioClose } from "./PortfolioClose";
import type { PortfolioItem, PortfolioPageContent } from "@/lib/content";

export function PortfolioRoot({
  items,
  content,
}: {
  items: PortfolioItem[];
  content: PortfolioPageContent;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const openIndex = items.findIndex((item) => item.id === openId);
  const open = openIndex >= 0 ? items[openIndex]! : null;

  const onOpen = useCallback((id: string) => setOpenId(id), []);
  const onClose = useCallback(() => setOpenId(null), []);

  // Wraps at both ends, so the sheet never presents a dead control.
  const onStep = useCallback(
    (delta: number) => {
      setOpenId((current) => {
        const index = items.findIndex((item) => item.id === current);
        if (index < 0) return current;
        const next = (index + delta + items.length) % items.length;
        return items[next]!.id;
      });
    },
    [items],
  );

  return (
    <div>
      <PortfolioMasthead items={items} content={content.masthead} />
      <PortfolioWall items={items} onOpen={onOpen} content={content.wall} />
      <PortfolioAnatomy items={items} onOpen={onOpen} content={content.anatomy} />
      <PortfolioClose items={items} content={content.close} />

      <CaseStudySheet
        item={open}
        index={openIndex < 0 ? 0 : openIndex}
        total={items.length}
        onClose={onClose}
        onStep={onStep}
        content={content.caseStudy}
      />
    </div>
  );
}
