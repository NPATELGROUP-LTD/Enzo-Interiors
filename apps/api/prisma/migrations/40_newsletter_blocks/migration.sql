-- Newsletter editor: the block list a newsletter was built from, so it can be opened and edited again.
-- Nullable; "html" stays the sanitised email body that is sent. Older newsletters have no blocks.
ALTER TABLE "newsletter_campaigns" ADD COLUMN "blocks" JSONB;
