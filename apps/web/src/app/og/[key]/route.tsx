import { cardKeys, OG_SIZE, renderCard } from "@/lib/og-card";

// The same content re-reads that drive the pages drive these.
export const revalidate = 3600;
export const generateStaticParams = cardKeys;

/** /og/<page or service slug>: the Open Graph share card. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  return renderCard((await params).key, OG_SIZE);
}
