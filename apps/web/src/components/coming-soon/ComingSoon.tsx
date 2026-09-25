import { Mail, Phone } from "lucide-react";
import { Countdown } from "@/components/coming-soon/Countdown";
import { OpenStatus } from "@/components/coming-soon/OpenStatus";
import { InstagramIcon } from "@/components/shared/icons";
import { MEDIA_BASE, getCompany, getPage, type SiteStatus } from "@/lib/content";

/** Only used when the company record has no Instagram row. */
const INSTAGRAM = "https://www.instagram.com/enzo.interiors/";

/** The homepage hero's kitchen: its first frame (the bare room) and its last (fitted). */
const EMPTY_ROOM = `${MEDIA_BASE}/site/hero/kitchen/frame_0001.webp`;
const FITTED_ROOM = `${MEDIA_BASE}/site/hero/kitchen/frame_0144.webp`;

/**
 * What every address shows until the site is live (Settings in the admin).
 *
 * One screen, nothing to scroll. The photograph is the studio's own hero
 * room, and the page's one moment of motion is that room being fitted: the
 * bare shell fades into the finished kitchen, which is what "nearly ready"
 * means here. The cream column carries the words, the time to launch, and
 * the ways to reach the studio today.
 */
export async function ComingSoon({ site }: { site: SiteStatus }) {
  const [{ comingSoon: copy }, company] = await Promise.all([getPage("site"), getCompany()]);
  // A date already passed still renders: this page can be a cached copy from
  // before launch, and the countdown shows "opening now" and reloads.
  const upcoming = site.launchAt ? new Date(site.launchAt) : null;
  const when = upcoming
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
      }).format(upcoming)
    : null;

  const instagram = company.socials.find((social) => social.id === "instagram");
  const contacts = [
    { href: company.phone.href, label: company.phone.display, Icon: Phone },
    { href: company.emailHref, label: company.email, Icon: Mail },
    { href: instagram?.href ?? INSTAGRAM, label: instagram?.handle ?? "@enzo.interiors", Icon: InstagramIcon, external: true },
  ];

  return (
    // The photograph takes the left so the reserved scrollbar lane
    // (scrollbar-gutter in theme.css) falls on cream, not on the picture.
    <main className="flex min-h-dvh flex-col bg-enzo-cream text-enzo-charcoal selection:bg-enzo-forest selection:text-enzo-cream lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      {/* Stacked (phones, tablets) the picture takes whatever height the words
          leave, so the page is exactly one screen on any of them. */}
      <figure className="relative min-h-32 flex-1 overflow-hidden bg-enzo-dark text-enzo-cream">
        {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed, sized by CSS */}
        <img src={EMPTY_ROOM} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed, sized by CSS */}
        <img
          src={FITTED_ROOM}
          alt="A fitted walnut kitchen with a stone island, lit at dusk"
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover motion-safe:animate-in motion-safe:fade-in duration-[2800ms] delay-500 ease-in-out fill-mode-both"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent via-40% to-black/45" />

        <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-6 px-6 pt-5 sm:px-10 lg:pt-9">
          {/* eslint-disable-next-line @next/next/no-img-element -- the one mark on the page, sized by CSS */}
          <img src={company.logos.onDark.src} alt={company.name} className="h-8 w-auto sm:h-10" />
          <p className="text-[13px] text-enzo-cream/90">
            <OpenStatus hours={company.hours} fallback={company.region} />
          </p>
        </header>
        <figcaption className="absolute bottom-0 left-0 px-6 pb-4 text-[10px] font-medium uppercase tracking-[0.24em] text-enzo-cream/85 sm:px-10 sm:text-[11px] lg:pb-9">
          {copy.eyebrow}
        </figcaption>
      </figure>

      <div className="flex flex-col justify-center gap-[clamp(1.25rem,4dvh,4rem)] px-6 py-6 sm:px-12 sm:py-10 lg:px-[clamp(3rem,6vw,7rem)] lg:py-[clamp(2rem,6dvh,4rem)]">
        <section>
          <h1 className="max-w-[14ch] font-title text-[clamp(1.85rem,min(7vw,5.5dvh),4.5rem)] font-medium lg:text-[clamp(2rem,min(4.4vw,8dvh),4.5rem)] leading-[1.02] tracking-[-0.035em] text-balance text-enzo-forest">
            {copy.heading}
          </h1>
          <p className="mt-4 max-w-[44ch] text-[14px] leading-relaxed text-enzo-charcoal/75 sm:mt-6 sm:text-base">{copy.body}</p>
        </section>

        <section className="border-t border-enzo-forest/15 pt-4 sm:pt-6">
          {upcoming ? (
            <>
              <p className="mb-3 flex flex-wrap justify-between gap-x-6 gap-y-1 text-[13px] text-enzo-charcoal/70 sm:mb-5">
                <span>{copy.countdownLabel}</span>
                <time dateTime={upcoming.toISOString()}>{when}</time>
              </p>
              <Countdown launchAt={upcoming.toISOString()} units={copy.units} launchingLabel={copy.launchingLabel} />
            </>
          ) : (
            <p className="font-title text-[clamp(1.75rem,4vw,3rem)] tracking-[-0.03em] text-enzo-forest">{copy.noDateLabel}</p>
          )}
        </section>

        <nav aria-label={copy.contactLabel} className="border-t border-enzo-forest/15 pt-4 sm:pt-6">
          <ul className="flex flex-wrap gap-x-8 gap-y-1 text-[14px]">
            {contacts.map(({ href, label, Icon, external }) => (
              <li key={href}>
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group inline-flex items-center gap-2.5 py-1 text-enzo-charcoal outline-none transition-colors hover:text-enzo-forest focus-visible:text-enzo-forest"
                >
                  <Icon size={15} className="shrink-0 text-enzo-forest/70" />
                  <span className="underline decoration-transparent underline-offset-[6px] transition-[text-decoration-color] duration-300 group-hover:decoration-enzo-forest/60 group-focus-visible:decoration-enzo-forest">
                    {label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
