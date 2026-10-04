import { getCompany, getGeneralFaqs, getServiceDetails, getSiteStatus, isLive, isPageOn } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

/**
 * /llms.txt: the site in plain Markdown, for AI assistants deciding whether
 * and how to recommend Enzo. Built from the published CMS content, so it
 * never disagrees with the pages it summarises.
 */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const site = await getSiteStatus();
  if (!isLive(site)) {
    return new Response("Not found", { status: 404 });
  }
  const [company, services, faqs] = await Promise.all([
    getCompany(),
    getServiceDetails(),
    getGeneralFaqs(),
  ]);

  const lines = [
    `# ${company.name}`,
    "",
    `> ${company.description} Serving ${company.region}.`,
    "",
    `${company.name} designs, builds and fits bespoke furniture from its own workshop in ${company.city}. Every job is measured, drawn, made and installed by the same small team, after a free home survey.`,
    "",
    // Pages switched off in Settings are not advertised.
    ...(isPageOn(site, "services")
      ? [
          "## Services",
          "",
          ...services.map(
            (service) =>
              `- [${service.title}](${SITE_URL}/services/${service.slug}): ${service.heroDesc}${
                service.pricing[0] ? ` From ${service.pricing[0].from}.` : ""
              }${service.timeline ? ` Typical timeline: ${service.timeline}.` : ""}`,
          ),
          "",
        ]
      : []),
    "## Pages",
    "",
    ...(isPageOn(site, "portfolio") ? [`- [Portfolio](${SITE_URL}/portfolio): finished projects across Leicestershire, with materials and time on site.`] : []),
    ...(isPageOn(site, "about") ? [`- [About](${SITE_URL}/about): the workshop, the team and how a project runs.`] : []),
    ...(isPageOn(site, "booking") ? [`- [Book a consultation](${SITE_URL}/booking): a free home survey, no obligation.`] : []),
    ...(isPageOn(site, "contact") ? [`- [Contact](${SITE_URL}/contact): enquiry form, phone and email.`] : []),
    "",
    "## Contact",
    "",
    `- Phone: ${company.phone.display}`,
    `- Email: ${company.email}`,
    `- Area: ${company.region}`,
    ...company.hours.rows.map((row) => `- ${row.day}: ${row.time}`),
  ];

  if (faqs.length) {
    lines.push("", "## Common questions", "");
    for (const { q, a } of faqs) lines.push(`### ${q}`, "", a, "");
  }

  return new Response(lines.join("\n").trimEnd() + "\n", {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
