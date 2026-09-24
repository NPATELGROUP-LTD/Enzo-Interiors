/**
 * The editor's map of the public site, in plain language.
 *
 * The content itself says what its fields are but not where they appear, and
 * Postgres has already thrown away the order they were written in (jsonb sorts
 * keys by length). This file puts both back: each page's sections in the
 * order a visitor scrolls through them, with a line saying what each one is.
 *
 * Only the editor reads this. A section missing from here still shows up in
 * the editor, after the known ones and under its own key's name, so adding a
 * section to a page never needs this file changed — it only reads better if
 * it is.
 */

export interface PageGuide {
  name: string;
  /** Where it lives on the site, for "View on site". Null for site-wide parts. */
  path: string | null;
  summary: string;
  /** In the order they appear on the page: [key, name, what it is]. */
  sections: Array<[key: string, name: string, help: string]>;
}

const SEO: [string, string, string] = [
  'metadata',
  'Metadata',
  'The page title (on the browser tab and in Google), the description under it in search results, and the image shown when the page is shared.',
];

/** Pages in the order the site's menu reaches them, site-wide parts last. */
export const PAGES: Record<string, PageGuide> = {
  home: {
    name: 'Home',
    path: '/',
    summary: 'The front page: the opening film, services, how we work, recent work and reviews.',
    sections: [
      ['hero', 'Opening film', 'The full-screen film at the top: the room captions as it pauses, and the booking card at the end.'],
      ['heroStatic', 'Opening banner (phones)', 'What phones and tablets show instead of the film: headline, two buttons and photos.'],
      ['servicesBoard', 'Services', 'Heading and intro above the service cards. The cards come from Services.'],
      ['process', 'How we work', 'The step-by-step process, from the first visit to handover.'],
      ['workshop', '3D workshop', 'The interactive 3D model, its viewpoints and the notes beside it.'],
      ['work', 'Recent work', 'Heading above the project photos. The projects come from Recent work.'],
      ['voices', 'Reviews', 'Heading above the review carousel. The reviews come from Testimonials.'],
      ['invite', 'Book a visit', 'The closing invitation at the bottom, with the phone number and email.'],
      SEO,
    ],
  },
  services: {
    name: 'Services',
    path: '/services',
    summary: 'The overview of all four services, with prices and what is always included.',
    sections: [
      ['hero', 'Top of page', 'The heading and intro above the list of services.'],
      ['pricing', 'What it costs', 'Heading and notes around the price table. Prices come from each service.'],
      ['constants', 'Always included', 'The promises that apply to every job, whichever service it is.'],
      ['questions', 'Questions', 'Heading above the FAQs. The questions come from FAQs.'],
      ['closing', 'Closing call to action', 'The booking prompt at the bottom of the page.'],
      SEO,
    ],
  },
  'service-detail': {
    name: 'Service pages',
    path: '/services/kitchens',
    summary:
      'The layout shared by all four service pages. What belongs to one service (its text, prices and photos) is edited in Services.',
    sections: [
      ['hero', 'Top of page', 'Facts, buttons and caption at the top of each service page.'],
      ['included', "What's included", 'The itemised list of what a job includes.'],
      ['model', '3D model', 'Labels and notes around the interactive 3D model.'],
      ['process', 'Process', 'The build stages, one version per service.'],
      ['investment', 'Investment guide', 'The price tiers and budget slider.'],
      ['questions', 'Questions', 'Heading above the FAQs for that service.'],
      ['cta', 'Closing call to action', 'The booking prompt at the bottom of the page.'],
      SEO,
    ],
  },
  portfolio: {
    name: 'Portfolio',
    path: '/portfolio',
    summary: 'The gallery of finished projects. The projects themselves are edited in Recent work.',
    sections: [
      ['masthead', 'Top of page', 'The heading and figures at the top of the gallery.'],
      ['wall', 'Project wall', 'The filterable grid of project photos.'],
      ['anatomy', 'Featured project', 'The close look at one project and what went into it.'],
      ['caseStudy', 'Project pop-up', 'Labels inside the pop-up that opens when a project is clicked.'],
      ['close', 'Closing questions', 'The questions and booking prompt at the bottom.'],
      SEO,
    ],
  },
  about: {
    name: 'About',
    path: '/about',
    summary: 'Who Enzo is: the studio, the numbers, how a project runs, values and the team.',
    sections: [
      ['statement', 'Opening statement', 'The large statement and portrait at the top of the page.'],
      ['numbers', 'In numbers', 'The key figures about the studio.'],
      ['journey', 'How a project runs', 'The timeline of a typical project, month by month.'],
      ['values', 'What we believe', 'The values, each set against what others do instead.'],
      ['team', 'The team', 'Heading above the team. The people come from Team.'],
      ['colophon', 'A note from the studio', 'The signed note near the end of the page.'],
      ['close', 'Closing call to action', 'The booking prompt at the bottom of the page.'],
      SEO,
    ],
  },
  contact: {
    name: 'Contact',
    path: '/contact',
    summary: 'Ways to get in touch, the enquiry form and what happens next.',
    sections: [
      ['masthead', 'Top of page', 'The heading and the ways to get in touch.'],
      ['docket', 'Enquiry form', 'Every label, hint, error message and confirmation on the form.'],
      ['when', 'What happens when', 'The timeline from enquiry to installation.'],
      ['ready', 'Before we visit', 'What is helpful to have ready, and what is not needed.'],
      SEO,
    ],
  },
  booking: {
    name: 'Book a consultation',
    path: '/booking',
    summary: 'The five-step booking form.',
    sections: [
      ['panel', 'Side panel', 'The heading, benefits and review beside the form.'],
      ['steps', 'Steps', 'The heading and text for each step. Which details are asked, and the days and times offered, are in Settings › Booking.'],
      ['nav', 'Buttons', 'Back, next and confirm.'],
      ['progress', 'Progress bar', 'The step counter above the form.'],
      ['toast', 'Confirmation message', 'The message shown once a booking is made.'],
      ['calendar', 'Calendar', 'Month and weekday names, and the messages while free days load.'],
      SEO,
    ],
  },
  legal: {
    name: 'Privacy, terms & cookies',
    path: '/privacy',
    summary: 'The three legal pages. Each has its own clauses; the labels at the end are shared by all three.',
    sections: [
      ['privacy', 'Privacy policy', 'The privacy page, clause by clause.'],
      ['terms', 'Terms & conditions', 'The terms page, clause by clause.'],
      ['cookies', 'Cookie policy', 'The cookie page, and the settings box on it.'],
      ['sheet', 'Shared labels', 'Small labels used on all three pages, like "Contents".'],
    ],
  },
  site: {
    name: 'Header & footer',
    path: null,
    summary: 'The parts on every page: header, footer, cookie banner and the "page not found" screen.',
    sections: [
      ['navbar', 'Header', 'The header buttons and menu labels. The menu links themselves are in Menu.'],
      ['footer', 'Footer', 'The footer headline, links, newsletter and copyright.'],
      ['cookieBanner', 'Cookie banner', 'The banner asking visitors about cookies.'],
      ['notFound', 'Page not found', 'What shows when an address does not exist.'],
      ['pageTransition', 'Page transition', 'The text shown while moving between pages.'],
      ['comingSoon', 'Coming-soon page', 'What every visitor sees before the site is live. The opening time is set in Settings.'],
      ['metadata', 'Default metadata', 'Used for any page that does not set its own.'],
    ],
  },
  shared: {
    name: 'Shared blocks',
    path: null,
    summary: 'Blocks that appear on more than one page, so an edit here changes all of them.',
    sections: [
      ['quoteModal', 'Quote pop-up', 'The quick-estimate pop-up opened from the service pages.'],
      ['bookSurveyCta', 'Book a survey banner', 'The booking banner used near the end of several pages.'],
      ['questions', 'FAQ heading', 'The heading above every FAQ list.'],
      ['roomSize', 'Room sizes', 'The small, medium and large room options.'],
      ['roomPlan', 'Room plan drawing', 'The caption on the room plan illustration.'],
    ],
  },
};

/** Loose top-level fields on a page, which get a pane of their own. */
export const DETAILS_GUIDE = {
  name: 'Page details',
  help: 'Settings that belong to the page as a whole.',
};

/**
 * Names for keys whose own name means nothing to an editor. Anything not
 * listed is humanised from its key, which is right for most of them.
 */
const FIELD_LABELS: Record<string, string> = {
  lede: 'Intro text',
  ledeShort: 'Intro text (short)',
  datum: 'Caption',
  lines: 'Heading lines',
  headingLines: 'Heading lines',
  eyebrow: 'Small heading',
  srHeading: 'Screen-reader heading',
  index: 'Section number',
  ctaLabel: 'Button text',
  ctaHref: 'Button link',
  buttonLabel: 'Button text',
  buttonHref: 'Button link',
  href: 'Link',
  q: 'Question',
  a: 'Answer',
  imageId: 'Photo',
  imageIds: 'Photos',
  galleryIds: 'Gallery',
  isPublished: 'Show on the website',
  navSummary: 'Menu summary',
  heroDesc: 'Banner text',
  overviewShort: 'Short overview',
  metadata: 'Metadata',
  titleTemplate: 'Title',
  descriptionTemplate: 'Description',
  clientName: 'Client name',
  authorId: 'Written by',
  onLight: 'Logo for light backgrounds',
  onDark: 'Logo for dark backgrounds',
  sub: 'Subheading',
  body: 'Text',
  process: 'Process steps',
  pricing: 'Price tiers',
  desc: 'Description',
  ogImageId: 'Share image (1200 × 630)',
  cta: 'Call to action',
  hold: 'Room caption',
  loader: 'Loading screen',
  transitions: 'Between rooms',
  scrollHint: 'Scroll prompt',
  card: 'Photo card',
  lead: 'Before',
  accent: 'Highlighted',
  tail: 'After',
};

/**
 * Keys the editor no longer shows. Their data stays (nothing is deleted), but
 * something else now controls what they did: the booking page's times come
 * from Settings › Booking, and the logos from Settings › Logo & icon.
 */
export const RETIRED: Partial<Record<string, string[]>> = {
  pages: ['timeSlots', 'wordmark'],
  company: ['logos'],
};

/** Where each kind of shared content shows up on the site, for the overview. */
export const USED_ON: Record<string, string> = {
  services: 'Home, Services, each service page and the menu',
  portfolio: 'Home and Portfolio',
  testimonials: 'Home',
  team: 'About',
  faqs: 'Services and each service page',
  navigation: 'The header on every page',
  company: 'Header, footer and Contact',
};

export function fieldLabel(key: string, humanize: (key: string) => string): string {
  return FIELD_LABELS[key] ?? humanize(key);
}

/**
 * Keys that are wiring rather than words: identifiers, screen-reader labels,
 * 3D camera numbers. Hidden unless "Show technical fields" is on, because a
 * form full of them is what made every page look harder to edit than it is.
 */
const TECHNICAL =
  /^(id|index|icon|key|kind|framesDir|frameCount|azimuth|polar|radius|targetY|valueSource|hrefSource|childPages)$|^sr[A-Z]|Sr[A-Z]|aria|Aria|(Nav|Group|Region)Label$/;

export function isTechnical(key: string): boolean {
  return TECHNICAL.test(key);
}
