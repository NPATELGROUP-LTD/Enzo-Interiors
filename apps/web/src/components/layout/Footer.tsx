"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ArrowRight, Phone, Check } from "lucide-react";
import gsap from "gsap";
import { CookieSettingsButton } from "@/components/legal/CookieSettingsButton";
import { revealOnScroll, scrollTimeline } from "@/hooks/useGSAP";
import { FacebookIcon, InstagramIcon } from "@/components/shared/icons";
import { FooterMap } from "@/components/layout/FooterMap";
import { TextRoll } from "@/components/shared/TextRoll";
import { HOURS_ROWS } from "@/lib/studio-hours";
import { cn } from "@/lib/utils";

// Exactly one more than socialLinks below — on any of these four pages the
// current one gets filtered out (see filteredPageLinks in the component),
// leaving 3, matching the 3 social links so both flanking columns read as
// the same length rather than a visibly lopsided 5-vs-3.
const pageLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/contact", label: "Contact" },
];

const socialLinks = [
  { href: "https://instagram.com/enzo.interiors", Icon: InstagramIcon, label: "Instagram" },
  { href: "https://facebook.com", Icon: FacebookIcon, label: "Facebook" },
  { href: "/contact", Icon: Phone, label: "WhatsApp" },
];

// The printed hours come from lib/studio-hours, which /contact also reads to
// answer "are they open right now?". They were two separate literals until
// the contact page needed the times as numbers — one of them would have
// gone stale the first time Friday's split afternoon moved.

const LABEL = "text-[10px] font-semibold uppercase tracking-[0.3em] text-enzo-cream/70";

function HoursList() {
  return (
    <div>
      <p className={cn(LABEL, "mb-4")}>Opening Hours</p>
      <div className="flex flex-col divide-y divide-enzo-cream/10">
        {HOURS_ROWS.map((row) => (
          <div
            key={row.day}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-2 py-2.5 text-[13px] transition-colors duration-200 hover:bg-enzo-cream/5"
          >
            <span className="font-medium text-enzo-cream">{row.day}</span>
            <span className={cn("tabular-nums text-enzo-cream/70", row.time === "Closed" && "text-enzo-cream/65")}>
              {row.time}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-enzo-cream/70">
        <Phone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-enzo-sand" />
        Consultation calls are available by appointment, outside these hours.
      </p>
    </div>
  );
}

function NewsletterForm({
  value,
  onChange,
  onSubmit,
  submittedEmail,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submittedEmail: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="w-full">
      <label htmlFor="footer-newsletter" className={cn(LABEL, "mb-3 block")}>
        The Studio Letter
      </label>
      <div className="flex items-center gap-2 border-b-2 border-enzo-cream/20 pb-2 transition-colors focus-within:border-enzo-sand">
        <input
          id="footer-newsletter"
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your email address"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-enzo-cream placeholder:text-enzo-cream/65 focus:outline-none"
          required
        />
        {/* Same pill-icon-chip mechanic as HeroCtaButton: two overlapping
            arrows swap places on hover (one exits top-right, the next
            enters from bottom-left) rather than a plain rotate, with the
            chip itself inverting colour. The button sits flat — it's the
            arrow glyph itself that's tilted 45°, pointing diagonally
            up-right like a "send" icon, matching the direction the swap
            already exits/enters from. */}
        <button
          type="submit"
          aria-label="Subscribe"
          className="group relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-enzo-sand text-enzo-forest transition-all duration-300 hover:scale-110 hover:bg-enzo-sage"
        >
          <ArrowRight className="h-4 w-4 -rotate-45 transition-all duration-300 ease-out group-hover:translate-x-3 group-hover:-translate-y-3 group-hover:opacity-0" />
          <ArrowRight className="absolute h-4 w-4 -translate-x-3 translate-y-3 -rotate-45 opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
        </button>
      </div>

      {/* Inline confirmation directly under the field, in the form's own
          flow — not a toast/portal floating elsewhere on screen. */}
      {submittedEmail && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-enzo-sage">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-enzo-sand text-enzo-forest">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          Thank you for subscribing with <span className="font-medium text-enzo-cream">{submittedEmail}</span>
        </p>
      )}
    </form>
  );
}

export function Footer() {
  const [newsletter, setNewsletter] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const pathname = usePathname();
  const filteredPageLinks = pageLinks.filter((item) => item.href !== pathname);
  const footerRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);

  // Two effects layered on the same, self-referential trigger
  // (`trigger: footer` — the footer's own scroll position, never dependent
  // on total document height or anything else on the page, which is what
  // every earlier scroll bug in this file traced back to):
  //
  // 1. A continuous parallax on just the headline (unchanged from before).
  // 2. A reveal, on scroll-in, that's genuinely different per section
  //    rather than one animation staggered across everything — Pages
  //    slides in from the left, Follow from the right (mirroring which
  //    side of the layout they sit on), the headline pops in with an
  //    overshoot, the contact block rises, hours pops in with more bounce,
  //    the map zooms in (fitting for a map), and the bottom bar just
  //    settles with a quiet fade. All seven still share ONE ScrollTrigger
  //    (self-referential to the footer, same safe pattern as the parallax
  //    above) — they're separate `.to()` calls on one timeline, positioned
  //    with small offsets for a loose cascade, not seven separate triggers.
  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Populated first, triggered second — see hooks/useGSAP.ts. A
      // trigger handed to gsap.timeline() measures while the timeline is
      // still empty, in the same synchronous pass every other reveal on the
      // page is being created.
      const parallax = scrollTimeline(
        (timeline) => {
          if (headlineRef.current) {
            timeline.fromTo(headlineRef.current, { yPercent: 6 }, { yPercent: -6, ease: "none" }, 0);
          }
        },
        { trigger: footer, start: "top bottom", end: "bottom top", scrub: 0.9 },
      );

      const q = (selector: string) => gsap.utils.toArray<HTMLElement>(footer.querySelectorAll(selector));
      const pages = q(".reveal-pages");
      const headline = q(".reveal-headline");
      const follow = q(".reveal-follow");
      const contact = q(".reveal-contact");
      const hours = q(".reveal-hours");
      const map = q(".reveal-map");
      const bottom = q(".reveal-bottom");

      gsap.set(pages, { x: -28, opacity: 0 });
      gsap.set(headline, { scale: 0.9, opacity: 0 });
      gsap.set(follow, { x: 28, opacity: 0 });
      gsap.set(contact, { y: 34, opacity: 0 });
      gsap.set(hours, { y: 24, scale: 0.96, opacity: 0 });
      gsap.set(map, { scale: 0.94, opacity: 0 });
      gsap.set(bottom, { y: 16, opacity: 0 });

      const intro = revealOnScroll(
        footer,
        (timeline) => {
          timeline
            .to(pages, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out", stagger: 0.07 }, 0)
            .to(headline, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.5)" }, 0.1)
            .to(follow, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out", stagger: 0.07 }, 0)
            .to(contact, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, 0.3)
            .to(hours, { y: 0, scale: 1, opacity: 1, duration: 0.65, ease: "back.out(1.7)" }, 0.38)
            .to(map, { scale: 1, opacity: 1, duration: 0.7, ease: "power2.out" }, 0.46)
            .to(bottom, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, 0.55);
        },
        { start: "top 85%" },
      );

      return () => {
        parallax.scrollTrigger?.kill();
        parallax.kill();
        intro.scrollTrigger?.kill();
        intro.kill();
      };
    });

    return () => mm.revert();
  }, []);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletter) {
      setSubmittedEmail(newsletter);
      setNewsletter("");
    }
  };

  return (
    <footer
      ref={footerRef}
      className="relative -mt-12 overflow-hidden rounded-t-[2.5rem] bg-enzo-forest text-enzo-cream sm:-mt-20"
    >
      {/* Small tab poking above the footer's own top edge — the same
          bridging detail the reference uses between the page above and the
          dark panel below. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-5 left-1/2 hidden h-10 w-28 -translate-x-1/2 rounded-t-full bg-enzo-forest md:block"
      />

      <div className="relative z-10 shell pb-10 pt-12 md:pb-14 md:pt-14">
        {/* ── Mobile (< md): simple composition, no bubble effect.
            Headline on its own line, then two columns — page links on the
            left, social icons on the right — plain pills and icon buttons,
            no animated text roll, no ref-avoided hover lifts. */}
        <div className="md:hidden">
          <div className="reveal-headline">
            <h2 className="font-title text-[clamp(1.7rem,7vw,2.2rem)] font-bold leading-[1.1] tracking-[-0.02em] text-enzo-cream">
              Live beautifully, designed with intent.
            </h2>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-8">
            <div>
              <p className={cn(LABEL, "mb-1")}>Pages</p>
              <ul className="flex flex-col divide-y divide-enzo-cream/10">
                {filteredPageLinks.map((item) => (
                  <li key={item.href} className="reveal-pages">
                    <Link
                      href={item.href}
                      className="flex min-h-11 items-center text-[15px] font-semibold text-enzo-cream/85 transition-colors duration-200 active:text-enzo-sand"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className={cn(LABEL, "mb-1")}>Follow</p>
              <ul className="flex flex-col divide-y divide-enzo-cream/10">
                {socialLinks.map(({ href, Icon, label }) => (
                  <li key={label} className="reveal-follow">
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                      aria-label={label}
                      className="flex min-h-11 items-center gap-2 text-[15px] font-semibold text-enzo-cream/85 transition-colors duration-200 active:text-enzo-sand"
                    >
                      <Icon size={15} className="text-enzo-sand" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── md+: the headline in the centre, flanked by its two navs —
            Pages on the left, Follow on the right.

            This used to render the *Follow* nav twice, once in each flank,
            with no Pages column at all, and two `md:order-*` utilities on
            top: the headline was ordered 2 and the left nav 1, while the
            right-hand nav carried no order at all and therefore sorted
            ahead of both. So the row actually painted as Follow, Follow,
            headline — two identical link lists jammed together on the left
            and the centrepiece shoved to the right edge. Source order is
            now the visual order (Pages, headline, Follow), so there is no
            `order` to disagree with. ── */}
        <div className="hidden items-center gap-6 md:grid md:grid-cols-[1fr_2fr_1fr]">
          <nav aria-label="Site pages" className="md:text-left">
            <p className={cn(LABEL, "mb-5")}>Pages</p>
            <ul className="space-y-3.5">
              {filteredPageLinks.map((item) => (
                <li key={item.href} className="reveal-pages">
                  <Link
                    href={item.href}
                    className="inline-block text-[20px] font-semibold text-enzo-cream/80 transition-colors duration-200 hover:text-enzo-cream"
                  >
                    <TextRoll>{item.label}</TextRoll>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div ref={headlineRef} className="reveal-headline group md:text-center">
            {/* Deliberately not TextRoll here — that letter-roll is the
                Pages/Follow links' signature move, and reusing it on the
                headline made it read as just another link-like element
                rather than the centrepiece. Each word instead lifts and
                grows on its own hover, a plain scale+translate pop rather
                than a character-level animation — a different kind of
                interaction, not a smaller version of the same one. */}
            <h2 className="font-display text-[7vw] font-bold uppercase leading-[0.92] tracking-[-0.02em] text-enzo-cream transition-transform duration-500 ease-out group-hover:scale-[1.015] md:text-[3.6rem] lg:text-[4.2rem]">
              <span className="inline-block cursor-default transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-110 hover:text-enzo-sand">
                Live
              </span>{" "}
              <span className="inline-block cursor-default font-title text-enzo-sand transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-110 hover:text-enzo-cream">
                beautifully,
              </span>
              <br />
              <span className="inline-block cursor-default transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-110 hover:text-enzo-sand">
                designed
              </span>{" "}
              <span className="inline-block cursor-default transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-110 hover:text-enzo-sand">
                with
              </span>{" "}
              <span className="inline-block cursor-default font-title text-enzo-sand transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-110 hover:text-enzo-cream">
                intent.
              </span>
            </h2>
          </div>

          <nav aria-label="Follow Enzo Interiors" className="md:text-right">
            <p className={cn(LABEL, "mb-5")}>Follow</p>
            <ul className="space-y-3.5">
              {socialLinks.map(({ href, label }) => (
                <li key={label} className="reveal-follow">
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="inline-block text-[20px] font-semibold text-enzo-cream/80 transition-colors duration-200 hover:text-enzo-cream"
                  >
                    <TextRoll>{label}</TextRoll>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Contact / newsletter / hours — two balanced columns, not three:
            a three-column split with the map as the third column left a
            visibly jagged bottom edge, since the map was consistently
            taller than the other two, leaving a large dead gap under the
            shorter ones. The map now runs full-width below instead, as its
            own row, which also sidesteps that mismatch entirely. */}
        <div className="mt-14 grid grid-cols-1 gap-10 border-t border-enzo-cream/15 pt-10 md:mt-16 md:grid-cols-2 md:gap-16 md:pt-12">
          <div className="reveal-contact">
            <p className={cn(LABEL, "mb-3")}>Begin A Conversation</p>
            <a
              href="mailto:hello@enzointeriors.co.uk"
              className="group touch-target inline-flex flex-wrap items-baseline gap-x-2 text-[1.2rem] font-bold leading-[1.1] tracking-tight text-enzo-cream"
            >
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_2px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 ease-out group-hover:bg-[length:100%_2px]">
                hello@enzointeriors.co.uk
              </span>
              <ArrowUpRight className="h-[0.55em] w-[0.55em] flex-shrink-0 text-enzo-sand transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>
            <a
              href="tel:+447777333052"
              className="mt-3 flex min-h-11 items-center gap-2 text-[14px] text-enzo-cream/70 transition-colors hover:text-enzo-cream"
            >
              <Phone className="h-3.5 w-3.5 flex-shrink-0 text-enzo-sand" />
              07777 333052
            </a>
            <div className="mt-8">
              <NewsletterForm
                value={newsletter}
                onChange={setNewsletter}
                onSubmit={handleNewsletterSubmit}
                submittedEmail={submittedEmail}
              />
            </div>
          </div>

          <div className="reveal-hours">
            <HoursList />
          </div>
        </div>

        <div className="reveal-map mt-10 md:mt-12">
          <p className={cn(LABEL, "mb-3")}>Where We Work</p>
          <FooterMap />
        </div>
      </div>

      {/* Bottom bar — copyright and "Made by" split onto their own lines
          (rather than run together in one sentence) so the hierarchy reads
          at a glance: what this is, who made it. Legal links get the same
          underline-sweep hover as every other link in this footer, instead
          of a bare colour change, for one consistent interaction language
          throughout. */}
      <div className="reveal-bottom relative z-10 shell flex flex-col-reverse items-center justify-between gap-5 border-t border-enzo-cream/15 py-8 sm:flex-row">
        <div className="text-center text-[13px] sm:text-left">
          <p className="font-semibold text-enzo-cream">
            &copy; {new Date().getFullYear()} Enzo Interiors. All rights reserved.
          </p>
          <p className="mt-1 text-enzo-cream/70">
            Made by <span className="font-semibold text-enzo-sand">NPATEL GROUP LTD</span>
          </p>
        </div>
        {/* The three notices, plus the consent-withdrawal control. The last
            one is not decoration: UK GDPR Art. 7(3) requires withdrawing
            consent to be as easy as giving it, which means reachable from
            every page rather than buried in a policy. */}
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[13px] font-semibold uppercase tracking-wide text-enzo-cream"
        >
          <Link href="/privacy" className="group relative touch-target">
            Privacy Policy
            <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-enzo-sand transition-transform duration-300 ease-out group-hover:scale-x-100" />
          </Link>
          <Link href="/terms" className="group relative touch-target">
            Terms
            <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-enzo-sand transition-transform duration-300 ease-out group-hover:scale-x-100" />
          </Link>
          <Link href="/cookies" className="group relative touch-target">
            Cookies
            <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-enzo-sand transition-transform duration-300 ease-out group-hover:scale-x-100" />
          </Link>
          <CookieSettingsButton className="group relative touch-target uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand">
            Cookie settings
            <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-enzo-sand transition-transform duration-300 ease-out group-hover:scale-x-100" />
          </CookieSettingsButton>
        </nav>
      </div>
    </footer>
  );
}
