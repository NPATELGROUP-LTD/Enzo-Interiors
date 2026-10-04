import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { OpeningHoursList } from "@/components/shared/OpeningHoursList";
import { getCompany } from "@/lib/content";

/**
 * /booking while its switch (Settings › Pages) is off: the online form is
 * paused, so the page hands the visitor the studio's own phone and email.
 * Phone, email and hours come from getCompany() (the published CMS bundle;
 * Settings › Opening hours overrides the hours). Inside the normal site chrome.
 */
export async function BookingByContact() {
  const { phone, email, emailHref, hours } = await getCompany();
  const route =
    "flex min-h-14 items-center justify-between gap-4 border-b border-enzo-forest/15 py-4 transition-colors hover:text-enzo-forest-light focus-visible:outline-none focus-visible:text-enzo-forest-light";
  const label = "text-[12px] font-medium uppercase tracking-[0.22em] text-enzo-forest/70";

  return (
    <section className="bg-enzo-cream text-enzo-charcoal">
      <div className="mx-auto grid min-h-[80dvh] max-w-6xl content-center gap-12 px-6 pb-24 pt-40 md:px-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div>
          <p className={label}>Book a consultation</p>
          <h1 className="mt-4 max-w-[16ch] font-title text-[clamp(2.25rem,6vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.035em] text-balance text-enzo-forest">
            Book your consultation.
          </h1>
          <p className="mt-6 max-w-[44ch] text-base leading-relaxed text-enzo-charcoal/75">
            Online booking is paused for now. Call or email us and we will arrange a free consultation directly.
          </p>
          <div className="mt-8 max-w-md border-t border-enzo-forest/15">
            {phone?.display && phone.href && (
            <a href={phone.href} className={route}>
              <span>
                <span className={`block ${label}`}>Call or text</span>
                <span className="mt-1 block font-title text-[1.5rem] font-medium tracking-[-0.02em] text-enzo-forest">
                  {phone.display}
                </span>
              </span>
              <ArrowRight size={16} aria-hidden />
            </a>
            )}
            {email && (
            <a href={emailHref} className={route}>
              <span className="min-w-0">
                <span className={`block ${label}`}>Email</span>
                <span className="mt-1 block break-words font-title text-[1.25rem] font-medium tracking-[-0.02em] text-enzo-forest sm:text-[1.5rem]">
                  {email}
                </span>
              </span>
              <ArrowRight size={16} aria-hidden />
            </a>
            )}
          </div>
          <Link
            href="/contact"
            className="mt-8 inline-flex min-h-11 items-center gap-2 text-[14px] text-enzo-forest underline decoration-enzo-forest/30 underline-offset-[6px] transition-colors hover:decoration-enzo-forest focus-visible:outline-none focus-visible:decoration-enzo-forest"
          >
            Other ways to reach us <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
        <div className="border-t border-enzo-forest/15 pt-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
          <OpeningHoursList label="Opening hours" rows={hours.rows} note={hours.note} />
        </div>
      </div>
    </section>
  );
}
