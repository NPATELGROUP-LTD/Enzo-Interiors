import { NotFoundView } from "@/components/shared/NotFoundView";
import { MEDIA_BASE, getCompany, getNavigation, getPage } from "@/lib/content";

/** The first frame of the hero's kitchen: the room before anything is built. */
const EMPTY_ROOM = "site/hero/kitchen/frame_0001.webp";
/** Where someone who took a wrong turn most likely meant to go. */
const WAYS_OUT = ["/services", "/portfolio", "/contact"];

export default async function NotFound() {
  const [site, navigation, company] = await Promise.all([
    getPage("site"),
    getNavigation(),
    getCompany(),
  ]);
  const links = navigation
    .filter((link) => WAYS_OUT.includes(link.path))
    .map((link) => ({ label: link.label, href: link.path, tagline: link.tagline }));

  return (
    <NotFoundView
      content={site.notFound}
      background={MEDIA_BASE ? `${MEDIA_BASE}/${EMPTY_ROOM}` : ""}
      links={links}
      phone={company.phone}
    />
  );
}
