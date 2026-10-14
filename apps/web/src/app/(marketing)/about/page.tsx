// /about — the studio.
//
// Seven sections, no two sharing a layout or a mechanic. See
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
//   06  AboutColophon   the founder's note, read as claim-then-reason: each
//                       paragraph's opening sentence at heading scale with
//                       its justification underneath (warm grey)
//   07  AboutClose      the ask, between two parting rules (near-black)
//
// Grounds run dark → cream → forest → cream → dark → warm grey → dark, so the
// footer's darker ground reads as a continuation rather than a cut — the
// same reasoning as the landing page's section order.
//
// Stays a Server Component, and everything it renders is fetched rather than
// written here: the page's own copy, the published services (§01 names the
// disciplines from them, so a fifth service joins that sentence on its own),
// the project count §02 counts to, the team table §05 draws and §06 quotes,
// and the company record §07 takes the phone number from. The milestones and
// promises reference images by id, resolved to sources below — on the server,
// so the media table never reaches the browser.
import type { Metadata } from "next";
import { PageUpdating } from "@/components/shared/PageUpdating";
import { offMetadata, pageOff } from "@/lib/page-gate";
import { pageMetadata } from "@/lib/seo";
import { AboutStatement } from "@/components/about/AboutStatement";
import { AboutNumbers } from "@/components/about/AboutNumbers";
import { AboutJourney, type Milestone } from "@/components/about/AboutJourney";
import { AboutValues, type AboutValue } from "@/components/about/AboutValues";
import { AboutTeam } from "@/components/about/AboutTeam";
import { AboutColophon } from "@/components/about/AboutColophon";
import { AboutClose } from "@/components/about/AboutClose";
import {
  getCompany,
  getMedia,
  getPage,
  getPortfolioItems,
  getServices,
  getTeam,
} from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  if (await pageOff("about")) return offMetadata("about");
  const metadata = (await getPage("about")).metadata;
  return pageMetadata({ ...metadata, path: "/about", ogKey: "about" });
}

export default async function AboutPage() {
  if (await pageOff("about")) return <PageUpdating page="about" />;
  const [services, projects, content, team, company, media] = await Promise.all([
    getServices(),
    getPortfolioItems(),
    getPage("about"),
    getTeam(),
    getCompany(),
    getMedia(),
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

  const milestones: Milestone[] = content.journey.milestones.map((milestone) => ({
    year: milestone.year,
    title: milestone.title,
    desc: milestone.desc,
    image: media(milestone.imageId).src,
  }));

  const values: AboutValue[] = content.values.items.map((item) => ({
    title: item.title,
    promise: item.promise,
    instead: item.instead,
    body: item.body,
    image: media(item.imageId).src,
  }));

  // Whose note §06 is, by id — the same record that appears on §05's bench,
  // so the two sections cannot disagree about who the founder is.
  const author = team.find((member) => member.id === content.colophon.authorId);

  return (
    <div>
      <AboutStatement
        disciplines={disciplines}
        portrait={media(content.statement.portraitId).src}
        content={content.statement}
      />
      <AboutNumbers content={content.numbers} projectCount={projects.length} />
      <AboutJourney milestones={milestones} content={content.journey} />
      <AboutValues values={values} content={content.values} />
      <AboutTeam team={team} content={content.team} />
      {author && (
        <AboutColophon
          content={content.colophon}
          author={author}
          written={milestones[milestones.length - 1]?.year ?? ""}
        />
      )}
      <AboutClose content={content.close} company={company} />
    </div>
  );
}
