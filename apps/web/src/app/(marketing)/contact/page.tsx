// /contact — the enquiry.
//
// ── Second design ──
// The first was the boilerplate port: a breadcrumb, "Get In Touch" at 4rem,
// a Google embed beside five stacked inputs, three icons in circles, and a
// WhatsApp strip. Every part of it exists on every trade website in the
// country, and the page repeated things the footer already carries on every
// other page of this one — the hours, the address, the map.
//
// Four sheets now, lettered C the way a service page is lettered A, none of
// them repeating the footer:
//
//   C1  ContactMasthead   the three ways in, each with the wait attached,
//                         under a live open/closed line (cream)
//   C2  ContactDocket     the enquiry: a sticky rail with a live checklist,
//                         the fields in a column beside it (near-white)
//   C3  ContactWhen       enquiry to finished room, as one week axis with a
//                         bar per discipline read off its real lead time
//                         (forest)
//   C4  ContactReady      what actually helps against the much longer list
//                         of things people wait for and never needed
//                         (warm grey)
//
// C2–C4 each hold that shape on a desk and re-form on a phone rather than
// shrinking: the docket's card chrome comes off and its fields become ruled
// lines, the territory plates become a ruled timetable, and the schedule
// turns from a 2×2 grid into one row per stage. Each of those is explained
// where it is written.
//
// ── The second pass on colour and layout ──
// The first version of C2–C4 ran near-black → warm grey → forest: three
// heavy grounds in a row, with the form — the one thing on this site a
// visitor has to *work* in — sitting on the darkest of them behind
// translucent fields. Contrast was backwards, and the page read as one long
// muddy slab.
//
// Now only C3 carries full-strength colour, and it earns it: eight labels
// and eight numbers, nothing to read at length and nothing to type into.
// The form sits on near-white with real bordered inputs, and C4 lands on
// warm grey — light, but distinct from both the cream masthead and the
// near-white sheet, so the four sections read as four steps rather than two
// pairs. Sage, the palette's one unused mid-tone, does the hover work
// throughout.
//
// Grounds run cream → near-white → forest → warm grey, and the footer's
// dark ground closes it.
//
// Stays a Server Component. The only fetch is the published services, which
// fill the docket's room picker: a fifth service appears in that list
// without anybody editing this file.
import type { Metadata } from "next";
import { ContactMasthead, type ContactRoute } from "@/components/contact/ContactMasthead";
import { ContactDocket, type RoomOption } from "@/components/contact/ContactDocket";
import { ContactWhen, type LeadTime } from "@/components/contact/ContactWhen";
import { ContactReady } from "@/components/contact/ContactReady";
import { getServiceDetails } from "@/lib/content";
import { getServiceMetrics } from "@/lib/service-metrics";

export const metadata: Metadata = {
  title: "Contact — Enzo Interiors",
  description:
    "Tell us about the room. A free home survey across Leicester and Leicestershire, with drawings and an honest figure before anything is cut.",
};

// PLACEHOLDERS, like the phone number everywhere else on this site — swap
// for the real line before production.
const PHONE_DISPLAY = "0116 XXX XXXX";
const PHONE_HREF = "tel:0116XXXXXXX";
const EMAIL = "hello@enzointeriors.co.uk";

const ROUTES: ContactRoute[] = [
  {
    index: "01",
    label: "The docket",
    value: "Send the details",
    datum: "A reply the same working day",
    href: "#contact-docket",
  },
  {
    index: "02",
    label: "By phone",
    value: PHONE_DISPLAY,
    datum: "Tuesday – Saturday, and by appointment",
    href: PHONE_HREF,
    external: true,
  },
  {
    index: "03",
    label: "By email",
    value: EMAIL,
    datum: "Read by the person who does the surveys",
    href: `mailto:${EMAIL}`,
    external: true,
  },
];

export default async function ContactPage() {
  const services = await getServiceDetails();

  // §C3's chart is read off the same `timeline` field the /services matrix
  // compares — never off a second set of figures authored beside it. A
  // service whose timeline cannot be parsed is listed with its own words
  // rather than given an invented bar.
  const leadTimes: LeadTime[] = services.map((service) => ({
    label: service.title.replace(/^(bespoke|fitted|custom)\s+/i, ""),
    timeline: service.timeline,
    weeks: getServiceMetrics(service).leadWeeks,
  }));

  // One chip per published service, plus a way out for anything that is not
  // one of them — a fifth service joins the row without anybody editing
  // this file.
  //
  // The sales adjective comes off the title first: the chips answer "which
  // room?", so "Kitchens" is the actual answer and "Bespoke Kitchens" is
  // the brochure's way of saying it. It is also what lets two chips sit on
  // one line at phone width instead of five stacked pills — the same trim
  // /about does to name the disciplines in its opening sentence.
  const rooms: RoomOption[] = [
    ...services.map((service) => ({
      value: service.slug,
      label: service.title.replace(/^(bespoke|fitted|custom)\s+/i, ""),
    })),
    { value: "other", label: "Something else" },
  ];

  return (
    <div>
      <ContactMasthead
        title={["Tell us about", "the room."]}
        lede="Three answers is enough to start. We survey before we quote — so the first thing you get from us is a visit and a drawing, not a price plucked off a page."
        routes={ROUTES}
        place="Leicester & Leicestershire"
      />

      <ContactDocket id="contact-docket" rooms={rooms} />

      <ContactWhen id="contact-visit" leadTimes={leadTimes} />

      <ContactReady
        id="contact-terms"
        phoneDisplay={PHONE_DISPLAY}
        phoneHref={PHONE_HREF}
        emailDisplay={EMAIL}
        emailHref={`mailto:${EMAIL}`}
      />
    </div>
  );
}
