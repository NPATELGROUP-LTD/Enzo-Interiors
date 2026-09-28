import { CmsCollection } from '../../common/types/domain';

/**
 * What the admin needs to know to render an editor for each collection.
 *
 * Deliberately NOT a field-by-field schema. The site's content is ~2,500 lines
 * of nested JSON across nine collections; describing every leaf here would mean
 * maintaining a second copy of the content model that silently rots the first
 * time someone adds a paragraph. Instead the admin walks the actual JSON value
 * and infers a widget from each value's type, and this file supplies only the
 * things the value cannot tell you:
 *
 *   - which keys hold a media id, so they get a picker rather than a text box
 *   - which keys point at another collection, so they get a dropdown
 *   - which keys are long-form copy, so they get a textarea rather than an input
 *   - which keys must not be edited (ids, slugs that are also routes)
 *   - what to call the collection, and which field titles a row in the list
 *
 * Served as-is to apps/admin over GET /cms/schema, so the shape is declared
 * once and drives both write validation and the form UI.
 */
export interface CollectionSchema {
  collection: CmsCollection;
  /** Plural, for the CMS menu. */
  label: string;
  /** Singular, for buttons: "New service". */
  singular: string;
  /** One line under the heading, telling the editor what this controls. */
  description: string;
  /**
   * Fixed-membership collections. The editor may edit the entries but not add
   * or delete them, because apps/web routes and components reference their
   * slugs by name — deleting the "home" page would 404 the site's front door.
   */
  fixed: boolean;
  /** Key whose value labels a row in the list view. */
  titleField: string;
  /** Extra keys to show as columns in the list view. */
  listColumns: string[];
  /** Keys holding a single media id. Rendered as an image picker. */
  mediaKeys: string[];
  /** Keys holding an array of media ids. Rendered as an ordered gallery picker. */
  mediaListKeys: string[];
  /** Keys holding long-form copy. Rendered as a textarea. */
  longTextKeys: string[];
  /** Keys that reference another collection by id, for a dropdown. */
  references: Record<string, CmsCollection>;
  /** Keys the editor may see but not change. */
  readonlyKeys: string[];
  /** Keys that control whether the row appears on the public site at all. */
  publishFlagKey?: string;
  /**
   * Every field an entry of this collection can have, blank. A new entry
   * starts from it, and the editor fills in any key an older entry lacks, so a
   * field the site shows is always there to edit. Kept to flat collections;
   * the nested ones (services, menu) start as an emptied copy of a sibling.
   */
  template?: Record<string, unknown>;
}

/**
 * Keys that mean the same thing wherever they appear. Listed once rather than
 * repeated in every collection below.
 */
const COMMON_LONG_TEXT = [
  'description',
  'overview',
  'overviewShort',
  'heroDesc',
  'navSummary',
  'note',
  'text',
  'pullQuote',
  'a',
  'answer',
  'body',
  'summary',
  'tagline',
  'desc',
  'blurb',
  'intro',
  'lede',
];

export const CMS_SCHEMAS: CollectionSchema[] = [
  {
    collection: 'pages',
    label: 'Pages',
    singular: 'page',
    description:
      'Every heading, paragraph, button label and SEO title on the public site, one entry per page. Editing here changes the words; the layout is fixed in code.',
    // Page keys are imported by apps/web by name (getPage("home")), so the set
    // is fixed. Adding a page means adding a route, which is a code change.
    fixed: true,
    titleField: 'title',
    listColumns: [],
    mediaKeys: [
      'imageId',
      'ogImageId',
      'backgroundId',
      'backgroundImageId',
      'posterId',
      'portraitId',
      'logoId',
    ],
    mediaListKeys: ['imageIds', 'galleryIds'],
    longTextKeys: COMMON_LONG_TEXT,
    // Page copy points into the shared collections in a few places: the
    // hero's rooms at services, the booking panel at a testimonial, the About
    // colophon at a team member. A dropdown there beats typing an id.
    references: { serviceId: 'services', testimonialId: 'testimonials', authorId: 'team' },
    readonlyKeys: ['id'],
  },
  {
    collection: 'services',
    label: 'Services',
    singular: 'service',
    description:
      'The four disciplines, their detail pages, and the Investment Guide tiers shown on each. The id is the page address (/services/kitchens) and cannot change.',
    fixed: false,
    titleField: 'title',
    listColumns: ['shortName', 'category', 'timeline'],
    mediaKeys: ['imageId'],
    mediaListKeys: ['galleryIds'],
    longTextKeys: COMMON_LONG_TEXT,
    references: {},
    // The id doubles as the route slug and is referenced by portfolio rows and
    // by the hero's room list, so it is set once at creation and then frozen.
    readonlyKeys: ['id'],
  },
  {
    collection: 'portfolio',
    label: 'Recent work',
    singular: 'project',
    description:
      'Completed projects, shown on the Portfolio page and in Recent work on the home page. The discipline shown on each card is read from the linked service, so it can never disagree with it.',
    fixed: false,
    titleField: 'title',
    listColumns: ['location', 'year', 'isPublished'],
    mediaKeys: [],
    mediaListKeys: ['imageIds'],
    longTextKeys: COMMON_LONG_TEXT,
    references: { serviceId: 'services' },
    readonlyKeys: ['id'],
    publishFlagKey: 'isPublished',
    template: {
      title: '',
      serviceId: '',
      location: '',
      client: '',
      duration: '',
      year: '',
      description: '',
      materials: [],
      imageIds: [],
      isPublished: false,
    },
  },
  {
    collection: 'testimonials',
    label: 'Testimonials',
    singular: 'testimonial',
    description:
      'Client reviews, shown on the home page and beside the booking form. The place under a name comes from the linked project unless you type one here.',
    fixed: false,
    titleField: 'clientName',
    listColumns: ['rating', 'isPublished'],
    mediaKeys: ['imageId'],
    mediaListKeys: [],
    longTextKeys: COMMON_LONG_TEXT,
    references: { projectId: 'portfolio' },
    readonlyKeys: ['id'],
    publishFlagKey: 'isPublished',
    template: {
      clientName: '',
      location: '',
      projectId: '',
      rating: 5,
      text: '',
      pullQuote: '',
      imageId: '',
      isPublished: false,
    },
  },
  {
    collection: 'team',
    label: 'Team',
    singular: 'team member',
    description: 'The people shown on the About page, in the order listed here.',
    fixed: false,
    titleField: 'name',
    listColumns: ['role'],
    mediaKeys: ['imageId'],
    mediaListKeys: [],
    longTextKeys: COMMON_LONG_TEXT,
    references: {},
    readonlyKeys: ['id'],
    template: { name: '', role: '', note: '', imageId: '' },
  },
  {
    collection: 'faqs',
    label: 'FAQs',
    singular: 'question',
    description:
      'Questions and answers. Leave the service blank for a question that appears on every service page rather than just one.',
    fixed: false,
    titleField: 'q',
    listColumns: ['serviceId'],
    mediaKeys: [],
    mediaListKeys: [],
    longTextKeys: COMMON_LONG_TEXT,
    references: { serviceId: 'services' },
    readonlyKeys: ['id'],
    template: { q: '', a: '', serviceId: null },
  },
  {
    collection: 'navigation',
    label: 'Menu',
    singular: 'menu item',
    description:
      'The header menu and the jump links inside each panel. The Services panel fills itself from the services above, so it is not listed here.',
    fixed: false,
    titleField: 'label',
    listColumns: ['path'],
    mediaKeys: [],
    mediaListKeys: [],
    longTextKeys: COMMON_LONG_TEXT,
    references: {},
    readonlyKeys: [],
  },
  {
    collection: 'company',
    label: 'Company details',
    singular: 'company details',
    description:
      'Phone, email, address, opening hours, social links and logos. These appear in the header, the footer and the contact page.',
    fixed: true,
    titleField: 'name',
    listColumns: [],
    mediaKeys: ['onLight', 'onDark'],
    mediaListKeys: [],
    longTextKeys: COMMON_LONG_TEXT,
    references: {},
    readonlyKeys: ['id'],
  },
];

const BY_COLLECTION = new Map(CMS_SCHEMAS.map((schema) => [schema.collection, schema]));

export function schemaFor(collection: string): CollectionSchema | null {
  return BY_COLLECTION.get(collection as CmsCollection) ?? null;
}
