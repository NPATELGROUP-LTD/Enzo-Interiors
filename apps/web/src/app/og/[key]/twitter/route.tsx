import { cardKeys, renderCard, TWITTER_SIZE } from "@/lib/og-card";

export const revalidate = 3600;
export const generateStaticParams = cardKeys;

/** /og/<key>/twitter: the same card at X's 2:1, so it is not cropped in the feed. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  return renderCard((await params).key, TWITTER_SIZE);
}
