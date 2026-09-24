# promo-video — "New website, launching soon"

Instagram launch videos for the new Enzo Interiors website, made with
[Remotion](https://www.remotion.dev). There are two cuts, and both use the
site's own brand: its palette, type, facts, room footage, photography and
real captures of the new pages.

- **Kinetic** (the main one): fast, loud and beat-cut, in the style of
  NPATEL Group's own reel, with its soundtrack.
- **Editorial**: a slower, quieter cut built from the site's signature
  motion (the measure rule, the self-inking drawing, the Fitted Run).

## What you get

| File (after `npm run render`) | Size | Length | Post it as |
|---|---|---|---|
| `out/enzo-kinetic-reel-9x16.mp4` | 1080×1920 | 30.4 s, **with music** | **Reel** (and Story) — the main launch post |
| `out/enzo-kinetic-cover-9x16.png` | 1080×1920 | still | The Reel's cover |
| `out/enzo-kinetic-feed-4x5.mp4` | 1080×1350 | 30.4 s, with music | Feed video post (and Facebook) |
| `out/enzo-launch-reel-9x16.mp4` | 1080×1920 | 27 s, silent | Editorial Reel |
| `out/enzo-reel-cover-9x16.png` | 1080×1920 | still | Editorial Reel's cover |
| `out/enzo-launch-feed-4x5.mp4` | 1080×1350 | 27 s, silent | Editorial feed video |
| `out/enzo-launch-story-9x16.mp4` | 1080×1920 | 11 s, silent | Story teaser, with room for the countdown sticker |
| `out/enzo-feed-poster-4x5.png` | 1080×1350 | still | A static feed post |

All videos are H.264, 30 fps, BT.709 colour, and made from a high-quality
master (CRF 16) so they survive Instagram's re-encode.

## The kinetic cut

The reference reel's shape is problem → fix → proof → call to action, with
a scene change on the music's beat. Here it is told about Enzo, using the
reasons the About page gives for the company existing:

| Time | Scene | On screen |
|---|---|---|
| 0:00 | Hook | **Still picking a kitchen from a brochure?** A catalogue that says "One size fits all" |
| 0:01.6 | | **Let's measure your room.** A dimension line across the brochure, "one size fits all" struck out, **MADE TO MEASURE** |
| 0:03.2 | Sign 1/4 | **Priced over the phone.** A quote that won't sit still: accuracy 3% |
| 0:04.4 | Sign 2/4 | **Nobody measured.** The dimensions are question marks |
| 0:05.6 | Sign 3/4 | **The wall wasn't straight.** 14 mm gap |
| 0:06.8 | Sign 4/4 | **Three trades. Who do you call?** Fitter calling… **NO ANSWER** |
| 0:08.0 | The fix | **So we do it all ourselves.** |
| 0:09.6 | | The Enzo logo, *Made in Leicester*; then a before/after of the homepage kitchen |
| 0:12.8 | | **One team, start to finish:** ✓ Measure ✓ Design ✓ Build ✓ Fit |
| 0:16.0 | | **Whatever the room:** kitchens from £4,500 · bedrooms £2,500 · media walls £1,800 · wardrobes £1,500 |
| 0:19.2 | | **Our new website. Launching soon.** The real site in a phone: every room we've finished, every price up front, book a free survey |
| 0:22.4 | | **Price in writing before we cut.** A quote with every line ticked, total fixed |
| 0:24.0 | | The site's Fitted Run, then **One team to call, even after handover.** 5-year guarantee |
| 0:25.6 | CTA | **Ready for a room that fits? DM us "SURVEY"** · enzointeriors.co.uk · New website, launching soon |

The type is Archivo, the site's heading face, set on its width axis as
Archivo Expanded Black, the kind of wide heavy grotesque the reference
shouts in. The colours are Enzo's: sage and forest do the jobs the
reference gives its blues, and outlines and hard shadows use the darkest
green of the site's door panels. Every figure is the site's own
(`apps/web/src/data`).

### The soundtrack

`public/audio/launch-reel.m4a` is the track from NPATEL Group's reel. The
cut is timed to it: the music runs at 150 BPM (a beat every 0.4 s, exactly
12 frames), and every scene starts on the same frame the reference changes
scene on, so the hits land on the cuts. The file is the original audio
**pre-rolled by 2048 samples** (42.7 ms). Remotion's AAC encode delays audio
by exactly that much, and the pre-roll cancels it. A render measures in
sync to within half a millisecond.

To use a different track, set the `soundtrack` prop to another file under
`public/`. A track at 150 BPM (or 75) keeps the cuts on the beat. Leave it
empty for a silent master.

## The editorial cut

| Time | Beat | What you see |
|---|---|---|
| 0:00 | **Measured.** `01 Consultation · 60–90 min` | A room is surveyed onto a drawing sheet: walls, dimensions, a figure for scale |
| 0:02 | **Drawn.** `02 Design · 5–7 days` | A fitted wardrobe inks itself in: carcass, bays, doors, then its finish and the HANDOVER stamp |
| 0:05 | **Built.** `03 Making · 2–4 weeks` | The kitchen from the homepage hero builds itself, empty to finished |
| 0:08 | **Fitted.** `04 Fitting · 2–5 days` | The media wall does the same |
| 0:11 | The Fitted Run | The site's page transition closes: **05 Something new** |
| 0:12 | **A new website, made to measure.** | The site's hero line, with one word changed. The sand site frame arrives, as it does on the homepage |
| 0:14 | The phone | The real site: Home → Services → Portfolio → Booking, with the site's own transition between pages |
| 0:22 | The close | The signature logo writes itself on: **New website, launching soon.** · `enzointeriors.co.uk` · Follow @enzo.interiors |

The Story teaser is the short version: *Something new is being fitted.*, the
bedroom building itself, then the close.

### Where the brand comes from

Nothing here is invented; it is mirrored from `apps/web`:

| Here | From |
|---|---|
| Colours, run panels, shadow gap | `apps/web/src/styles/theme.css`, `components/shared/PageTransition.tsx` |
| Easing and durations (GSAP → Remotion) | `apps/web/src/lib/motion.ts` |
| Archivo / Inter / Space Grotesk | `apps/web/src/app/layout.tsx` (bundled here from npm, OFL) |
| The measure rule | `components/shared/SectionIntro.tsx` |
| The self-inking drawing | `components/landing/ElevationDrawing.tsx` |
| Masked headline reveals, CTA pill, rotating badge, site frame | `SectionIntro`, `HeroCtaButton`, `RotatingBadge`, `app/layout.tsx` |
| Copy, stages, room captions, facts ("from £1,500", "9 rooms") | `apps/web/src/data/*.json` |
| Logo, photography, the three room-build sequences | `apps/web/public` (copied in by `npm run sync-assets`) |

If the site changes, `src/brand/tokens.ts`, `src/brand/copy.ts` and the
kinetic scenes (`src/kinetic/scenes.tsx`) are where to bring it back in
step.

## Using it

Needs Node 20+. From this folder:

```bash
npm install
npm run dev          # Remotion Studio: preview, scrub, edit the words live
npm run render       # everything, into out/
```

Or one cut at a time: `npm run render:kinetic` (Reel, feed and cover), or
`render:editorial`, which runs `render:reel`, `render:feed`, `render:story`
and `render:stills`.

The first render downloads Remotion's headless Chrome. On a machine that
cannot download it, set `REMOTION_BROWSER_EXECUTABLE` to an existing Chrome
or chrome-headless-shell.

### Changing the words

The launch line, address, handle, soundtrack and (kinetic cut only) the DM
keyword are props. Change them in the Studio's props panel (right-hand
side), or on the command line:

```bash
npx remotion render KineticReel out/reel.mp4 --props='{"launchLine":"live 1 October","domain":"enzointeriors.co.uk","handle":"@enzo.interiors","soundtrack":"audio/launch-reel.m4a","dmKeyword":"SURVEY"}'
```

Every line of display type is fitted to the frame, so a longer launch line
or keyword resizes rather than overflowing. Everything else is in
`src/brand/copy.ts` and `src/kinetic/scenes.tsx`.

### Music

The kinetic cut carries its soundtrack (see [The soundtrack](#the-soundtrack)).
The editorial cut is silent: add a track from Instagram's own music library
when you post, or set its `soundtrack` prop to a file under `public/audio/`.

### Refreshing the phone screens

The phone shows real captures of the new site (`public/site/*.jpg`).
Re-capture them when the pages change:

```bash
cd ../apps/web && npm run dev                 # the site on :3000
cd ../../promo-video && npx playwright install chromium   # once
npm run capture-site                          # SITE_URL=… to capture staging instead
```

## Posting guide

**Order:** post the editorial Story teaser a few days ahead with a countdown
sticker. Post the kinetic Reel on launch week. Use the feed video or the
poster to re-share on launch day.

### Reel

- **Cover:** upload `enzo-kinetic-cover-9x16.png` (or
  `enzo-reel-cover-9x16.png` for the editorial cut). The profile grid crops
  Reels to the centre 3:4, and both covers keep everything inside that crop.
- **Audio:** the kinetic Reel already has its music. Post it as it is; don't
  add a second track in Instagram.
- **DMs:** the kinetic Reel ends on *DM us "SURVEY"*, so someone needs to be
  watching the inbox for that word. Change it with the `dmKeyword` prop.
- **Safe zones:** in both Reels the words sit between roughly y 230 and
  y 1600 and clear of the right-hand like/comment column, so Instagram's
  interface never covers them.
- **Caption:**

  > We measure every wall before we draw a line, and draw every room before we cut a sheet. This time the room is our own.
  >
  > Our new website is nearly finished: every room we've fitted, what each service costs before you ask, and a free home survey you can book in four questions.
  >
  > Launching soon at enzointeriors.co.uk. Follow along and we'll post the day it goes live.
  >
  > Fitted kitchens, bedrooms, media walls and wardrobes — drawn, made and fitted in Leicester.

- **Hashtags** (Instagram now recommends 3–5): `#FittedFurniture #BespokeKitchens #FittedWardrobes #MediaWall #LeicesterInteriors`
- **Alt text** (Advanced settings → Accessibility):

  > Kinetic cut: bold words slam onto green backgrounds. "Still picking a kitchen from a brochure? Let's measure your room." Four signs follow: priced over the phone, nobody measured, the wall wasn't straight, nobody answers. Then "So we do it all ourselves", the Enzo Interiors logo, a kitchen before and after, a checklist of measure, design, build and fit, and prices for kitchens, bedrooms, media walls and wardrobes. A phone shows the new Enzo Interiors website. It ends on "Ready for a room that fits? DM us 'SURVEY'", enzointeriors.co.uk, new website launching soon.
  >
  > Editorial cut: a drawing of a fitted wardrobe inks itself onto a sheet, then a kitchen and a media wall build themselves in empty rooms. Green door panels close and open on the words "A new website, made to measure." A phone scrolls through the new Enzo Interiors website. It ends on the Enzo Interiors logo and "New website, launching soon. enzointeriors.co.uk".

### Story

- Add the **Countdown** sticker (set to launch day) in the clear band
  between the headline and the button, about half to two-thirds of the way
  down. People can tap it to get a reminder.
- Once the site is live, swap the countdown for a **Link** sticker in the
  same place.

### Feed post

- `enzo-launch-feed-4x5.mp4` as a video post, or `enzo-feed-poster-4x5.png`
  as a still: *A new website, made to measure.* over Enzo's own media-wall
  photograph.
- Shorter caption: *A new website, made to measure. Every room we've
  finished, every price up front, and a free home survey in four questions.
  Launching soon — enzointeriors.co.uk*

## Project layout

```
src/
  brand/        tokens (colour, motion), fonts, copy — mirrored from apps/web
  components/   the brand devices: RuleRow, Masked, ElevationSheet, FittedRun,
                RoomBuild, Plate, Phone, Brand (logo, frame, CTA, badge)
  kinetic/      the kinetic cut: type (glyph-fitted Archivo Expanded), palette,
                parts (sweep, sticker, card, ribbon…), illos, scenes, KineticReel
  scenes/       ProcessScene (cream act), SiteScene (forest act + the close)
  compositions/ Launch (Reel + Feed), StoryTeaser, Stills, Soundtrack
  layout.ts     where everything sits in 9:16 and 4:5
  props.ts      the editable words
scripts/
  sync-assets.mjs    copies logo, photos and room frames from apps/web/public
  capture-site.mjs   captures the site's pages for the phone
public/site/         the captures (committed)
public/audio/        the kinetic cut's soundtrack (committed)
```

## Notes

- **The soundtrack's licence:** the kinetic cut uses the music from
  NPATEL Group's own reel. If that track was licensed only for that video,
  as some stock-music licences are, check that it also covers posting on
  Enzo's account. If it doesn't, swap in a licensed track with the
  `soundtrack` prop.
- **Licence:** Remotion is free for individuals and for companies with up to
  three employees. Larger for-profit companies need a
  [Remotion company licence](https://www.remotion.dev/license). The About
  page lists four people at Enzo, so check which applies to whoever renders.
- **Fonts** are bundled from npm, so renders need no network and look the
  same on every machine.
- The current captures were taken on a connection that could not reach the
  site's stock-image CDN (Unsplash), so a few images that failed to load are
  hidden. The pages shown in the phone (the home hero, the services price
  list, the portfolio figures and booking) don't depend on them.
  Re-capturing on a normal connection gives complete pages.
