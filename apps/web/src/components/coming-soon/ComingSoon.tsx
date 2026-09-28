import { ComingSoonNewsletter } from "@/components/coming-soon/ComingSoonNewsletter";
import { Countdown } from "@/components/coming-soon/Countdown";
import { getCompany, getPage, type SiteStatus } from "@/lib/content";

/**
 * What every address shows until the site is live (Settings in the admin).
 *
 * Deliberately one screen: the mark, a line of copy from the CMS, the time to
 * launch, and a way to reach the studio today. A visitor who came for a
 * kitchen should still leave with a phone number.
 */
export async function ComingSoon({ site }: { site: SiteStatus }) {
  const [page, company] = await Promise.all([getPage("site"), getCompany()]);
  const copy = page.comingSoon;
  // A date already passed still renders: this page can be a cached copy from
  // before launch, and the countdown shows "opening now" and reloads.
  const upcoming = site.launchAt ? new Date(site.launchAt) : null;
  const when = upcoming
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Europe/London",
      }).format(upcoming)
    : null;

  return (
    <main className="relative isolate flex min-h-dvh flex-col bg-enzo-forest text-enzo-cream">
      <header className="px-6 pt-10 sm:px-12 md:pt-14">
        {/* eslint-disable-next-line @next/next/no-img-element -- the one mark on the page, sized by CSS */}
        <img
          src={company.logos.onDark.src}
          alt={company.name}
          className="h-12 w-auto sm:h-14"
        />
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 py-16 sm:px-12">
        <div className="max-w-3xl space-y-6">
          <p className="font-display text-xs uppercase tracking-[0.22em] text-enzo-sage sm:text-sm">
            {copy.eyebrow}
          </p>
          <h1 className="font-title text-[clamp(2.25rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-balance">
            {copy.heading}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-enzo-cream/75 sm:text-lg">{copy.body}</p>
        </div>

        {/* The measure rule the site uses elsewhere: a sand hairline that
            carries the launch date, or just "Opening soon" before there is one. */}
        <div className="max-w-2xl space-y-4 border-t border-enzo-sand/40 pt-5">
          {when ? (
            <p className="text-sm text-enzo-cream/70">
              {copy.countdownLabel} · <time dateTime={upcoming!.toISOString()}>{when}</time>
            </p>
          ) : (
            <p className="font-display text-2xl font-medium tracking-tight text-enzo-sand sm:text-3xl">
              {copy.noDateLabel}
            </p>
          )}
          {upcoming ? (
            <Countdown launchAt={upcoming.toISOString()} units={copy.units} launchingLabel={copy.launchingLabel} />
          ) : null}
        </div>

        {/* Hear when it opens — and, before launch, where the newsletter's
            confirm and unsubscribe links land. */}
        <ComingSoonNewsletter content={page} />
      </section>

      <footer className="flex flex-col gap-4 border-t border-enzo-cream/10 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-12">
        <p className="text-enzo-cream/60">{copy.contactLabel}</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <a className="underline-offset-4 hover:underline focus-visible:underline" href={company.phone.href}>
              {company.phone.display}
            </a>
          </li>
          <li>
            <a className="underline-offset-4 hover:underline focus-visible:underline" href={company.emailHref}>
              {company.email}
            </a>
          </li>
          {company.socials
            .filter((social) => social.href.startsWith("https://"))
            .map((social) => (
              <li key={social.id}>
                <a
                  className="text-enzo-cream/70 underline-offset-4 hover:text-enzo-cream hover:underline focus-visible:underline"
                  href={social.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {social.label}
                </a>
              </li>
            ))}
        </ul>
      </footer>
    </main>
  );
}
