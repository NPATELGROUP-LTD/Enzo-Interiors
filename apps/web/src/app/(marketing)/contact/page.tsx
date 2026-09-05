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
//   C3  ContactVisit      the ninety minutes of the survey, drawn as one
//                         bar whose phases are sized by their real share of
//                         the time (forest)
//   C4  ContactTerms      the refusals — what we will not do, and what
//                         happens instead (warm grey)
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
import { ContactVisit, type TerritoryPlace } from "@/components/contact/ContactVisit";
import { ContactTerms, type EnquiryTerm } from "@/components/contact/ContactTerms";
import { getServices } from "@/lib/content";

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

// Drive from the workshop. The figures are what sets the length of each
// rule in §C3, so they want to stay honest rather than flattering.
const TERRITORY: TerritoryPlace[] = [
  { name: "Leicester", minutes: 10 },
  { name: "Oadby & Wigston", minutes: 15 },
  { name: "Syston & Birstall", minutes: 20 },
  { name: "Hinckley", minutes: 30 },
  { name: "Market Harborough", minutes: 30 },
  { name: "Loughborough", minutes: 35 },
  { name: "Melton Mowbray", minutes: 35 },
];

// The refusals. Every one of these restates a claim this site already makes
// somewhere else — see the note at the top of ContactTerms — rather than
// introducing a new promise on the client's behalf.
const TERMS: EnquiryTerm[] = [
  {
    never: "Send a salesperson",
    instead:
      "Nobody here is paid commission, and there is nobody here whose job is selling. The person who measures your room is the person who draws it and the person who fits it.",
  },
  {
    never: "Sit on your enquiry",
    instead:
      "A person reads it and replies the same working day, and the reply answers what you actually asked rather than offering you a call back.",
  },
  {
    never: "Price a room we have not measured",
    instead:
      "The figures on this site are ranges for planning. The real one comes after the survey, with a drawing attached to it, in three to five working days.",
  },
  {
    never: "Give you a price that expires tonight",
    instead:
      "There is no discount for deciding quickly and no penalty for thinking about it. The number is the number whenever you come back to it.",
  },
  {
    never: "Take money before you have seen it",
    instead:
      "Nothing is cut and nothing is charged until you have signed off a drawing you are happy with. Change that drawing as many times as you like first.",
  },
  {
    never: "Hand your install to somebody else",
    instead:
      "One team from the bench to the handover. No subcontracted fitters, and nobody in your house you have not already met.",
  },
];
export default async function ContactPage() {
  const services = await getServices();

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

      <ContactVisit
        id="contact-visit"
        places={TERRITORY}
        note="Further out than this we will still come — we simply say so before the visit is booked rather than after, and we will tell you honestly if the drive makes us the wrong people for the job."
      />

      <ContactTerms
        id="contact-terms"
        terms={TERMS}
        phoneDisplay={PHONE_DISPLAY}
        phoneHref={PHONE_HREF}
        emailDisplay={EMAIL}
        emailHref={`mailto:${EMAIL}`}
      />
    </div>
  );
}
