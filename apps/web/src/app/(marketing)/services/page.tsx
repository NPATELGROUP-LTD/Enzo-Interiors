// /services — the discipline index.
//
// Five sections, no two sharing a layout or a scroll mechanic. See
// src/components/services/README.md for the file map.
//
//   01  IndexHero          the drawing, driven by the list under it (dark)
//   02  IndexPricingScale  one money scale, pinned and drawn by scroll (cream)
//   03  IndexConstants     a travelling rule inks each promise in (forest)
//   04  QuestionsNotes     the answers, typeset in two columns; below lg, a
//                          closed accordion (`mobileAccordion`) (off-white)
//   05  IndexClosing       the ask, set on a drawing sheet (near-black)
//
// Grounds run dark → cream → forest → off-white → dark, so the footer's
// darker ground reads as a continuation rather than a cut — the same
// reasoning as the landing page's section order.
//
// §02 is the only pinned section on the page, and it is the only one that
// should be: it takes the screen for one idea, holds it while the visitor
// draws the scale with their own wheel, and hands it back. Adding a second
// pin below it would turn the page into a slideshow and would also mean two
// triggers competing to re-measure everything under them.
//
// Stays a Server Component: it fetches the records and hands them down.
// Every section is written against `ServiceDetail[]` of any length, because
// in production the client publishes services themselves from the Admin
// Content Manager — nothing here assumes there are four.
//
// §04's questions are the FAQ rows with no service of their own — the same
// table each service page draws its own questions from, filtered the other
// way. They used to be a second hand-written copy in this file, which is a
// duplicate waiting to drift the first time one of the answers is corrected.
import type { Metadata } from "next";
import { PageUpdating } from "@/components/shared/PageUpdating";
import { offMetadata, pageOff } from "@/lib/page-gate";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { faqLd } from "@/lib/structured-data";
import { IndexHero } from "@/components/services/services-index/IndexHero";
import { IndexPricingScale } from "@/components/services/services-index/IndexPricingScale";
import { IndexConstants } from "@/components/services/services-index/IndexConstants";
import { QuestionsNotes } from "@/components/services/shared/QuestionsNotes";
import { IndexClosing } from "@/components/services/services-index/IndexClosing";
import { getCompany, getGeneralFaqs, getPage, getServiceDetails } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  if (await pageOff("services")) return offMetadata("services");
  const metadata = (await getPage("services")).metadata;
  return pageMetadata({ ...metadata, path: "/services", ogKey: "services" });
}

export default async function ServicesPage() {
  if (await pageOff("services")) return <PageUpdating page="services" />;
  const [services, content, shared, faqs, company] = await Promise.all([
    getServiceDetails(),
    getPage("services"),
    getPage("shared"),
    getGeneralFaqs(),
    getCompany(),
  ]);

  return (
    <div>
      {faqs.length ? <JsonLd data={faqLd(faqs)!} /> : null}
      <IndexHero services={services} content={content.hero} roomPlan={shared.roomPlan} />
      <IndexPricingScale services={services} content={content.pricing} />
      <IndexConstants content={content.constants} />
      <QuestionsNotes
        id={content.questions.id}
        index={content.questions.index}
        lines={content.questions.lines}
        lede={content.questions.lede}
        faqs={faqs}
        content={shared.questions}
        mobileAccordion
      />
      <IndexClosing services={services} content={content.closing} company={company} />
    </div>
  );
}
