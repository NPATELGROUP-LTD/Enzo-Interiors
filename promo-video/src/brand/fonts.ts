// The site's three faces (apps/web/src/app/layout.tsx):
//
//   Archivo        headings — a grotesque on a tight grid, set heavy and tight
//   Inter          reading text
//   Space Grotesk  the technical numerals and labels the measure rule runs on
//
// Bundled from npm (@fontsource-variable, SIL Open Font License) rather than
// fetched from Google Fonts at render time, so a render never depends on the
// network and every machine draws exactly the same letters. Remotion holds
// each frame until they are loaded.
import archivoUrl from "@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2";
import archivoWideUrl from "@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2";
import interUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2";
import spaceGroteskUrl from "@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2";
import { loadFont } from "@remotion/fonts";

export const font = {
  heading: "Archivo",
  body: "Inter",
  display: "Space Grotesk",
  /**
   * Archivo again, with its width axis: set at 125% and weight 900 it is
   * Archivo Expanded Black — the heavy, wide face the kinetic cut shouts in,
   * without leaving the site's own heading family.
   */
  wide: "Archivo Expanded",
} as const;

// Variable fonts: one file covers every weight the design uses.
loadFont({ family: font.heading, url: archivoUrl, weight: "100 900" });
loadFont({ family: font.body, url: interUrl, weight: "100 900" });
loadFont({ family: font.display, url: spaceGroteskUrl, weight: "300 700" });
loadFont({ family: font.wide, url: archivoWideUrl, weight: "100 900", stretch: "62% 125%" });

/**
 * Archivo at display sizes, as the site sets it: semibold, tracked in hard
 * (theme.css / SectionIntro use -0.035em to -0.045em, tightening with size).
 */
export const headingStyle = (size: number) =>
  ({
    fontFamily: font.heading,
    fontWeight: 600,
    fontSize: size,
    lineHeight: 1.02,
    letterSpacing: "-0.045em",
  }) as const;
