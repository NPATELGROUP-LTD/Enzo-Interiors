// /about — the studio.
//
// Six sections, no two sharing a layout or a mechanic. See
// src/components/about/ for the files.
//
//   01  AboutStatement  one sentence at masthead scale, with the discipline
//                       cycling in a slot of its own (near-black)
//   02  AboutNumbers    four figures on one ruled row, counted (cream)
//   03  AboutJourney    a setting-out run — dated plates stepping down and
//                       right, months dimensioned on the runs (forest)
//   04  AboutValues     three full-bleed plates, one refusal and its answer
//                       printed on each — no second mechanism to fall
//                       behind (cream)
//   05  AboutTeam       one ruled bench: unequal plates on a shared baseline,
//                       with a try-square riding the line (near-black)
//   06  AboutColophon   the note's own best line, lifted to headline scale,
//                       with the letter set plainly underneath (warm grey)
//   07  AboutClose      the ask, between two parting rules (near-black)
//
// Grounds run dark → cream → forest → cream → dark → warm grey → dark, so the
// footer's darker ground reads as a continuation rather than a cut — the
// same reasoning as the landing page's section order.
//
// Stays a Server Component. The only fetch is the published services, which
// §01 uses to name the disciplines in its sentence: a fifth service joins
// that sentence without anybody editing this file. Everything else here is
// studio copy that has no `GET /content/*` endpoint behind it (milestones,
// promises, the founder's note), so it lives with the page rather than being
// invented in src/lib/content.
import type { Metadata } from "next";
import { AboutStatement } from "@/components/about/AboutStatement";
import { AboutNumbers, type AboutFigure } from "@/components/about/AboutNumbers";
import { AboutJourney, type Milestone } from "@/components/about/AboutJourney";
import { AboutValues, type AboutValue } from "@/components/about/AboutValues";
import { AboutTeam, type TeamMember } from "@/components/about/AboutTeam";
import { AboutColophon } from "@/components/about/AboutColophon";
import { AboutClose } from "@/components/about/AboutClose";
import { getServices, getPortfolioItems } from "@/lib/content";

export const metadata: Metadata = {
  title: "About — Enzo Interiors",
  description:
    "A small Leicester workshop making fitted kitchens, bedrooms, media walls and wardrobes. We measure, draw, build and fit every job ourselves.",
};

const WORKSHOP_IMG =
  "https://images.unsplash.com/photo-1768471125958-78556538fadc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnRlcmlvciUyMGRlc2lnbmVyJTIwcG9ydHJhaXQlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzcyMjk3MTMzfDA&ixlib=rb-4.1.0&q=80&w=1080";
// The founder, used twice: his plate on the bench (§05) and above his
// signed note (§06). One face, so the two sections read as one person.
const PORTRAIT_IMG =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

const MILESTONES: Milestone[] = [
  {
    year: "June 2025",
    title: "One bench, one van, one saw.",
    desc: "Enzo Interiors started in Leicester with a workshop, a set of tools and a conviction that fitted furniture ought to be measured in the room it is going into rather than picked off a page.",
    image:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    year: "August 2025",
    title: "The first kitchen went in, in Oadby.",
    desc: "A bespoke fitted kitchen, drawn from a survey and built to the millimetre. It is still the job we point at when somebody asks what we mean by handmade.",
    image:
      "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    year: "November 2025",
    title: "Our own fitters, not subcontractors.",
    desc: "We brought installation in-house rather than hiring it out. The person who measures your room is now the person who draws it, and our own team is the one who fits it — no handovers, nobody blaming the last trade.",
    image:
      "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    year: "March 2026",
    title: "Fifty rooms across Leicestershire.",
    desc: "Kitchens, bedrooms, media walls and wardrobes, from Oadby and Wigston out to Market Harborough and Loughborough. Every one of them surveyed before it was quoted.",
    image:
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
];

const VALUES: AboutValue[] = [
  {
    title: "Guess",
    promise: "We will not price a room we have not measured.",
    instead:
      "We survey first, every time — free, whether or not you go ahead.",
    body: "A figure given over the phone is a guess dressed up as a quote, and the person it usually costs is you. Every wall gets measured and every corner photographed before a price is written down.",
    image:
      "https://images.unsplash.com/photo-1721522282337-6b6d3e366463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBraXRjaGVuJTIwc2FnZSUyMGdyZWVuJTIwZml0dGVkfGVufDF8fHx8MTc3MjM5ODIzMnww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    title: "Subcontract",
    promise: "We will not hand your job to somebody you have not met.",
    instead:
      "The person who measures your room draws it. Our own fitters install it.",
    body: "Nothing is farmed out, so there is nobody to blame and nobody to chase — just us, from the first visit to the last handle.",
    image:
      "https://images.unsplash.com/photo-1709544345907-ceea96cb69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXNwb2tlJTIwZml0dGVkJTIwYmVkcm9vbSUyMHdhcm0lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzIzOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    title: "Cut",
    promise: "We will not cut a sheet before you have signed the drawing.",
    instead:
      "You sign the drawing first. Only then does anything get cut.",
    body: "You see the room in 3D — finishes, handles, internal layout — and approve it before a single board goes on the saw. Changing a drawing costs nothing. Changing a fitted carcass costs a great deal.",
    image:
      "https://images.unsplash.com/photo-1722942432154-067a239bc58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXR0ZWQlMjB3YXJkcm9iZSUyMHdhbGstaW4lMjBjbG9zZXQlMjBsdXh1cnl8ZW58MXx8fHwxNzcyMzk4MjMyfDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

// PLACEHOLDER PEOPLE. Names, roles and portraits are stand-ins in exactly
// the same way the client names ("Sarah & Mark Thompson") and the phone
// number ("0116 XXX XXXX") elsewhere on the site are — swap them for the real
// bench before this goes anywhere near production. The *shape* is what
// matters: four people, each named against the part of a job they are
// actually standing in front of, because that is what makes the "no
// subcontractors" claim two sections above checkable.
const TEAM: TeamMember[] = [
  {
    name: "Oyz Khan",
    role: "Founder — surveys and drawings",
    note: "Comes to your house, measures every wall, and draws what he found.",
    image: PORTRAIT_IMG,
  },
  {
    name: "Rhea Kaur",
    role: "Designer — 3D and finishes",
    note: "Builds the room in 3D so you can sign it off before anything is cut.",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    name: "Tom Bradley",
    role: "Bench joiner — the workshop",
    note: "Cuts, edges and assembles every carcass on the bench in Leicester.",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    name: "Marek Nowak",
    role: "Lead fitter — installation",
    note: "The one in your room with a screwdriver, scribing it to your walls.",
    image:
      "https://images.unsplash.com/photo-1521119989659-a83eee488004?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
];

const NOTE = [
  "I started Enzo because I kept seeing the same thing go wrong. Somebody chooses a kitchen from a brochure, a salesperson quotes it before anyone has been to the house, and then the fitters arrive and discover the wall is not straight. Everybody loses a fortnight and somebody eats the cost.",
  "So we do it the other way round. We come to you, we measure every wall and photograph every corner, and we draw the room you actually have rather than the one the brochure assumed. Then you see it in 3D and sign it off, and only then does anything get cut.",
  "It is slower, and it means we turn work down when we are full. I would rather do that than rush a room you are going to stand in every morning for the next fifteen years.",
];

export default async function AboutPage() {
  const [services, projects] = await Promise.all([
    getServices(),
    getPortfolioItems(),
  ]);

  // The sentence is "We make ___ that fit.", so it wants a plain plural
  // noun. The category is not it — the media-wall record's category is
  // "Entertainment", and "we make entertainment that fit" is nonsense. The
  // title is closer but carries a sales adjective ("Bespoke Kitchens"), so
  // the adjective comes off and the rest is lower-cased: kitchens, bedrooms,
  // media walls, wardrobes.
  const disciplines = services.map((service) =>
    service.title.replace(/^(bespoke|fitted|custom)\s+/i, "").toLowerCase(),
  );

  const figures: AboutFigure[] = [
    {
      value: projects.length,
      suffix: "+",
      label: "Rooms finished",
      note: "Kitchens, bedrooms, media walls and wardrobes across Leicestershire.",
    },
    {
      value: 0,
      label: "Subcontractors",
      note: "Measured, drawn, built and fitted by the same people.",
    },
    {
      value: 5,
      suffix: " yr",
      label: "Guarantee",
      note: "In writing, on every installation, whichever discipline you pick.",
    },
    {
      value: null,
      text: "Free",
      label: "Home survey",
      note: "60–90 minutes at your place, with nothing to sign at the end.",
    },
  ];

  return (
    <div>
      <AboutStatement disciplines={disciplines} portrait={WORKSHOP_IMG} />
      <AboutNumbers figures={figures} />
      <AboutJourney milestones={MILESTONES} />
      <AboutValues values={VALUES} />
      <AboutTeam team={TEAM} />
      <AboutColophon
        name="Oyz Khan"
        role="Founder, and the one who measures"
        portrait={PORTRAIT_IMG}
        paragraphs={NOTE}
        written={MILESTONES[MILESTONES.length - 1]!.year}
        place="The workshop, Leicester"
      />
      <AboutClose />
    </div>
  );
}
