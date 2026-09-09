// Facts every service hero shows, derived once so the four hero designs
// stay four *layouts* rather than four slightly different sets of content.
//
// Nothing here is authored: lead time comes off the record, the starting
// price is the cheapest published tier, and the survey/guarantee lines are
// studio-wide constants. A service published in the Admin Content Manager
// therefore arrives with a complete hero whichever variant it lands on.
import { getServiceMetrics } from "@/lib/service-metrics";
import type { ServiceDetail } from "@/lib/content";

export interface HeroFact {
  label: string;
  value: string;
}

export function getHeroFacts(service: ServiceDetail): HeroFact[] {
  const metrics = getServiceMetrics(service);

  const facts: HeroFact[] = [
    { label: "Lead time", value: metrics.timeline },
    { label: "Survey", value: "Free, at home" },
    { label: "Guarantee", value: "5 years" },
  ];

  if (metrics.fromPriceLabel) {
    facts.push({ label: "From", value: metrics.fromPriceLabel });
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
