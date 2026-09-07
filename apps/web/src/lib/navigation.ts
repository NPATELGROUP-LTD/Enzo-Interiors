// The site's navigation model — one source of truth for the header.
//
// ── Why the panels only ever point inside their own page ──
// A panel lists the *sections of the page it belongs to*, in the order they
// appear on it, each anchored to a real element id — never links to other
// pages. The panel is a table of contents, which is the one thing a name in
// a menu bar can usefully expand into, and the only arrangement where five
// panels are five different things.
//
// Every `href` below is `<page path>#<section id>`. The ids are set on the
// section elements themselves; if one is renamed, it is renamed here too and
// nowhere else.
import {
  Home as HomeIcon,
  Sofa,
  Image as ImageIcon,
  Users,
  Mail,
} from "lucide-react";

interface NavSection {
  /** Sheet index as the page itself letters it — "01", "C3", "A2". */
  index: string;
  label: string;
  /** `<path>#<id>`, pointing at a section of this nav item's own page. */
  href: string;
  description: string;
}

/** A child *page*, not a section of this one. Only Services has any. */
interface NavPage {
  label: string;
  href: string;
  description: string;
}

interface NavLink {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /** One line about the page, shown beside its contents. */
  tagline: string;
  sections: NavSection[];
  /**
   * Pages *below* this one in the site, listed alongside its sections rather
   * than instead of them. Services is the only nav item with children, and
   * they are the four things a visitor came to the menu looking for — making
   * them reachable in one hover is worth more than the strict "this page
   * only" rule the rest of the panel keeps to. Everything else here still
   * points inside its own page.
   */
  pages?: NavPage[];
}

export const NAV_LINKS: NavLink[] = [
  {
    label: "Home",
    path: "/",
    icon: HomeIcon,
    tagline: "Bespoke interiors, designed around how you live.",
    sections: [
      { index: "01", label: "What we make", href: "/#home-services", description: "The four disciplines" },
      { index: "02", label: "How a job runs", href: "/#home-process", description: "Survey to handover" },
      { index: "03", label: "In the workshop", href: "/#home-workshop", description: "Turn the unit over" },
      { index: "04", label: "Recent work", href: "/#home-work", description: "Rooms we have finished" },
      { index: "05", label: "What clients say", href: "/#home-reviews", description: "A year after we left" },
      { index: "06", label: "Come and see", href: "/#home-studio", description: "The studio invitation" },
    ],
  },
  {
    label: "Services",
    path: "/services",
    icon: Sofa,
    tagline: "Fitted furniture, designed and installed end to end.",
    pages: [
      { label: "Bespoke Kitchens", href: "/services/kitchens", description: "Cabinetry, worktops, appliances" },
      { label: "Fitted Bedrooms", href: "/services/bedrooms", description: "Wardrobes, headboards, bedsides" },
      { label: "Media Walls", href: "/services/media-walls", description: "Screen, storage, fire, lighting" },
      { label: "Fitted Wardrobes", href: "/services/wardrobes", description: "Walk-ins and awkward rooms" },
    ],
    sections: [
      { index: "01", label: "The disciplines", href: "/services#services-hero", description: "Kitchens to wardrobes" },
      { index: "02", label: "What it costs", href: "/services#services-pricing", description: "Every service, to scale" },
      { index: "03", label: "What never changes", href: "/services#services-constants", description: "Included on every job" },
      { index: "04", label: "Questions", href: "/services#services-questions", description: "Asked before committing" },
      { index: "05", label: "Book a survey", href: "/services#services-close", description: "Free, in your home" },
    ],
  },
  {
    label: "Portfolio",
    path: "/portfolio",
    icon: ImageIcon,
    tagline: "Every room we have finished, with the details attached.",
    sections: [
      { index: "01", label: "The archive", href: "/portfolio#portfolio-hero", description: "Counted and dated" },
      { index: "02", label: "Every project", href: "/portfolio#portfolio-wall", description: "Filter by room" },
      { index: "03", label: "One in full", href: "/portfolio#portfolio-anatomy", description: "A job taken apart" },
      { index: "04", label: "The next one", href: "/portfolio#portfolio-next", description: "What it all adds up to" },
    ],
  },
  {
    label: "About",
    path: "/about",
    icon: Users,
    tagline: "Leicester-based designers and makers.",
    sections: [
      { index: "01", label: "The statement", href: "/about#about-statement", description: "What we actually do" },
      { index: "02", label: "By the numbers", href: "/about#about-numbers", description: "Counted, not claimed" },
      { index: "03", label: "How we got here", href: "/about#about-journey", description: "Bench to workshop" },
      { index: "04", label: "What we refuse", href: "/about#about-values", description: "And what we do instead" },
      { index: "05", label: "The bench", href: "/about#about-team", description: "Who turns up" },
      { index: "06", label: "The note", href: "/about#about-colophon", description: "In our own words" },
    ],
  },
  {
    label: "Contact",
    path: "/contact",
    icon: Mail,
    tagline: "Tell us about the room.",
    sections: [
      { index: "C1", label: "Three ways in", href: "/contact#contact-masthead", description: "With the wait attached" },
      { index: "C2", label: "Send the details", href: "/contact#contact-docket", description: "Four fields, no more" },
      { index: "C3", label: "The survey", href: "/contact#contact-visit", description: "Ninety minutes, itemised" },
      { index: "C4", label: "What we will not do", href: "/contact#contact-terms", description: "And what happens instead" },
    ],
  },
];
