// The 404. A Server Component that reads the copy and hands it to the view —
// the animations and `router.back()` are what need the client, not the words.
import { NotFoundView } from "@/components/shared/NotFoundView";
import { getPage } from "@/lib/content";

export default async function NotFound() {
  const site = await getPage("site");
  return <NotFoundView content={site.notFound} />;
}
