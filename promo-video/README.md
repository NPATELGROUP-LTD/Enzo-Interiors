# promo-video — "New website, launching soon"

Instagram launch videos for the new Enzo Interiors website, made with
[Remotion](https://www.remotion.dev). Everything here uses the site's own
brand: its palette, type, motion timings and signature devices, its room
footage and photography, and real captures of the new pages.

## What you get

| File (after `npm run render`) | Size | Length | Post it as |
|---|---|---|---|
| `out/enzo-launch-reel-9x16.mp4` | 1080×1920 | 27 s | **Reel** — the main launch post |
| `out/enzo-reel-cover-9x16.png` | 1080×1920 | still | The Reel's cover (Edit cover → Add from camera roll) |
| `out/enzo-launch-feed-4x5.mp4` | 1080×1350 | 27 s | Feed video post (and Facebook) |
| `out/enzo-launch-story-9x16.mp4` | 1080×1920 | 11 s | **Story** teaser, with room for the countdown sticker |
| `out/enzo-feed-poster-4x5.png` | 1080×1350 | still | A static feed post or carousel card |

All videos are H.264, 30 fps, BT.709 colour, and made from a high-quality
master (CRF 16) so they survive Instagram's re-encode. They are silent on
purpose; see [Music](#music).

## The story

The film tells the website launch the way Enzo tells a job, through the
site's own process stages:

| Time | Beat | What you see |
|---|---|---|
| 0:00 | **Measured.** `01 Consultation · 60–90 min` | A room is surveyed onto a drawing sheet: walls, dimensions, a figure for scale |
| 0:02 | **Drawn.** `02 Design · 5–7 days` | A fitted wardrobe inks itself in: carcass, bays, doors, then its finish and the HANDOVER stamp |
| 0:05 | **Built.** `03 Making · 2–4 weeks` | The kitchen from the homepage hero builds itself, empty to finished |
| 0:08 | **Fitted.** `04 Fitting · 2–5 days` | The media wall does the same |
| 0:11 | The Fitted Run | The site's page transition closes: **05 Something new** |
| 0:12 | **A new website, made to measure.** | The site's hero line, with one word changed. The sand site-frame arrives, as it does on the homepage |
| 0:14 | The phone | The real site: Home → Services ("Every price, up front.") → Portfolio ("Every room we have finished.") → Booking ("Book a free survey in four questions."), with the site's own transition between pages |
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

If the site changes, `src/brand/tokens.ts` and `src/brand/copy.ts` are the
two files to bring back in step. Each one names its sources.

## Using it

Needs Node 20+. From this folder:

```bash
npm install
npm run dev          # Remotion Studio: preview, scrub, edit the words live
npm run render       # all three videos and both stills, into out/
```

Or one at a time: `npm run render:reel`, `render:feed`, `render:story`,
`render:stills`.

The first render downloads Remotion's headless Chrome. On a machine that
cannot download it, set `REMOTION_BROWSER_EXECUTABLE` to an existing Chrome
or chrome-headless-shell.

### Changing the words

The closing line, address and handle are props. Change them in the Studio's
props panel (right-hand side), or on the command line:

```bash
npx remotion render LaunchReel out/reel.mp4 --props='{"launchLine":"live 1 October","domain":"enzointeriors.co.uk","handle":"@enzo.interiors","soundtrack":""}'
```

`launchLine` becomes the sage second line: "New website, **live 1
October.**" The headline resizes itself to fit. Everything else is in
`src/brand/copy.ts`.

### Music

The master is silent. Add a track from Instagram's own music library when
you post: it is licensed for the platform, and Instagram favours Reels that
use its audio. Keep it calm and instrumental so it matches the pace.

To bake in a track you hold the rights to, put it under `public/audio/`
and set the `soundtrack` prop to `audio/<file>.mp3`. It fades in and out
automatically.

### Refreshing the phone screens

The phone shows real captures of the new site (`public/site/*.jpg`).
Re-capture them when the pages change:

```bash
cd ../apps/web && npm run dev                 # the site on :3000
cd ../../promo-video && npx playwright install chromium   # once
npm run capture-site                          # SITE_URL=… to capture staging instead
```

## Posting guide

**Order:** post the Story teaser a few days ahead with a countdown sticker.
Post the Reel on launch week. Use the feed video or the poster to re-share
on launch day.

### Reel

- **Cover:** upload `enzo-reel-cover-9x16.png`. The profile grid crops Reels
  to the centre 3:4, and everything on the cover sits inside that crop.
- **Safe zones:** all text in the film sits between y 236 and y 1560 and
  clear of the right-hand like/comment column, so Instagram's interface never
  covers it.
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

  > A drawing of a fitted wardrobe inks itself onto a sheet, then a kitchen and a media wall build themselves in empty rooms. Green door panels close and open on the words "A new website, made to measure." A phone scrolls through the new Enzo Interiors website. It ends on the Enzo Interiors logo and "New website, launching soon. enzointeriors.co.uk".

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
  scenes/       ProcessScene (cream act), SiteScene (forest act + the close)
  compositions/ Launch (Reel + Feed), StoryTeaser, Stills, Soundtrack
  layout.ts     where everything sits in 9:16 and 4:5
  props.ts      the editable words
scripts/
  sync-assets.mjs    copies logo, photos and room frames from apps/web/public
  capture-site.mjs   captures the site's pages for the phone
public/site/         the captures (committed)
```

## Notes

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
