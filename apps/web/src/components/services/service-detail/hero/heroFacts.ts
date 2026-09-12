// Facts every service hero shows, derived once so the four hero designs
// stay four *layouts* rather than four slightly different sets of content.
//
// The values come off the record — lead time from its timeline, the starting
// price from the cheapest published tier — while the labels, and the two
// studio-wide lines, are copy from src/data/pages/service-detail.json. A
// service published in the Admin Content Manager therefore arrives with a
// complete hero whichever variant it lands on.
import { getServiceMetrics } from "@/lib/service-metrics";
import type { ServiceDetail, ServiceDetailContent } from "@/lib/content";

export interface HeroFact {
  label: string;
  value: string;
}

export function getHeroFacts(
  service: ServiceDetail,
  content: ServiceDetailContent["hero"]["facts"],
): HeroFact[] {
  const metrics = getServiceMetrics(service);

  const facts: HeroFact[] = [
    { label: content.leadTimeLabel, value: metrics.timeline },
    { label: content.survey.label, value: content.survey.value },
    { label: content.guarantee.label, value: content.guarantee.value },
  ];

  if (metrics.fromPriceLabel) {
    facts.push({ label: content.fromLabel, value: metrics.fromPriceLabel });
  }
  return facts;
}

/**
 * Splits a title into its visual lines. Two-word titles ("Media Walls")
 * read best stacked; anything longer would make a very tall heading, so it
 * stays on one line and lets the type size do the work.
 */
export function titleLines(title: string): string[] {
  const words = title.trim().split(/\s+/);
  return words.length === 2 ? words : [title];
}
