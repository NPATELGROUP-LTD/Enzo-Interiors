// TEMPORARY PLACEHOLDER — this exists only to verify the App Router shell
// (fonts, design tokens, Navbar, Footer, SSR) renders end-to-end. The real
// homepage (hero slides, services, portfolio preview, testimonials,
// booking CTA per docs/websitemap.md) ships in the next branch and will
// fully replace this file.
export default function HomePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 pt-20 text-center">
      <div>
        <p className="text-[12px] uppercase tracking-[0.25em] text-secondary">
          Enzo Interiors
        </p>
        <h1 className="mt-4 text-foreground">Site under construction</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          The Next.js App Router scaffold is live — the real homepage lands
          in the next branch.
        </p>
      </div>
    </div>
  );
}
