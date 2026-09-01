import type { Service, ServiceDetail } from "./types";

// Single source of truth for services.
//
// This used to be split in two: a short list here (for the landing rail)
// and a richer per-category record in
// app/(marketing)/services/[category]/data.ts (for the detail page). That
// split was already a maintenance trap — the same title, image and feature
// list existed twice — and it became untenable once /services grew a
// specification matrix that compares lead times and starting prices across
// every service, i.e. a *list* surface that needs *detail* fields.
//
// In production the client authors these records in the Admin Content
// Manager and they arrive over `GET /content/services`, so both consumers
// read one shape. Treat every array below as variable-length: the number of
// services, process steps, pricing tiers, materials and FAQs are all
// author-controlled, and every component that renders them is written to
// cope with any count (see docs/architecture.md, "Public Content").
//
// Image URLs are the same Unsplash sources the boilerplate used as
// placeholders — swap for real S3-backed URLs once the endpoint exists.
const KITCHEN_IMG =
  "https://images.unsplash.com/photo-1771627278637-10eb2e9857b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmaXR0ZWQlMjBraXRjaGVuJTIwZGFyayUyMGRyYW1hdGljJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzcyMzk4MjMwfDA&ixlib=rb-4.1.0&q=80&w=1080";
const BEDROOM_IMG =
  "https://images.unsplash.com/photo-1709544345907-ceea96cb69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXNwb2tlJTIwZml0dGVkJTIwYmVkcm9vbSUyMHdhcm0lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzIzOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080";
const MEDIA_IMG =
  "https://images.unsplash.com/photo-1764344814733-930223ac186c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRlcnRhaW5tZW50JTIwY2VudGVyJTIwbWVkaWElMjB3YWxsJTIwbW9kZXJufGVufDF8fHx8MTc3MjM5ODIzN3ww&ixlib=rb-4.1.0&q=80&w=1080";
const WARDROBE_IMG =
  "https://images.unsplash.com/photo-1722942432154-067a239bc58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXR0ZWQlMjB3YXJkcm9iZSUyMHdhbGstaW4lMjBjbG9zZXQlMjBsdXh1cnl8ZW58MXx8fHwxNzcyMzk4MjMyfDA&ixlib=rb-4.1.0&q=80&w=1080";

const SERVICE_DETAILS: ServiceDetail[] = [
  {
    title: "Bespoke Kitchens",
    category: "Kitchens",
    slug: "kitchens",
    image: KITCHEN_IMG,
    description:
      "Handcrafted kitchen designs tailored to your lifestyle and space.",
    heroDesc:
      "Handcrafted kitchen designs tailored to your lifestyle, cooking habits, and aesthetic preferences.",
    overview:
      "Our kitchens are designed from scratch to perfectly suit your home. Every cabinet, worktop, and fitting is tailored to your exact requirements. We use only premium materials and finishes, ensuring your kitchen not only looks stunning but stands the test of time. From contemporary handleless designs to classic shaker styles, we bring your vision to life.",
    features: [
      "Custom cabinetry & worktops",
      "Integrated appliance planning",
      "Premium handle & finish selection",
      "3D design visualisation",
      "Full project management",
      "5-year workmanship guarantee",
      "Soft-close mechanisms on all doors",
      "LED under-cabinet lighting",
      "Quartz or granite worktop options",
      "Bespoke island designs",
    ],
    process: [
      {
        step: "Home Consultation",
        desc: "We visit your home, measure the space, and discuss your vision, lifestyle needs, and budget.",
      },
      {
        step: "3D Design & Material Selection",
        desc: "Our designers create photorealistic 3D renders. Choose from hundreds of finishes, handles, and worktop materials.",
      },
      {
        step: "Manufacturing",
        desc: "Your kitchen is precision-manufactured in our workshop to exact specifications.",
      },
      {
        step: "Professional Installation",
        desc: "Our experienced fitters install everything to the highest standard, typically within 3-5 days.",
      },
    ],
    pricing: [
      {
        tier: "Essential",
        desc: "Quality fitted kitchen with standard finishes",
        from: "£4,500",
        features: [
          "Laminate worktops",
          "Standard cabinetry",
          "Soft-close hinges",
          "Choice of 30+ door styles",
        ],
      },
      {
        tier: "Premium",
        desc: "Elevated design with premium materials",
        from: "£8,000",
        features: [
          "Quartz worktops",
          "Premium cabinetry",
          "Integrated lighting",
          "Handleless options",
          "Integrated appliances",
        ],
      },
      {
        tier: "Luxury",
        desc: "Fully bespoke with the finest materials",
        from: "£15,000",
        features: [
          "Granite/Dekton worktops",
          "Bespoke cabinetry",
          "Full LED lighting",
          "Smart storage solutions",
          "Wine cooler integration",
          "Boiling water tap",
        ],
      },
    ],
    gallery: [KITCHEN_IMG],
    faqs: [
      {
        q: "How long does a kitchen installation take?",
        a: "Typically 4-6 weeks from design approval to completion. Installation itself takes 3-5 days.",
      },
      {
        q: "Do you remove the old kitchen?",
        a: "Yes, we handle full removal and disposal of your existing kitchen as part of the project.",
      },
      {
        q: "Can I keep my existing appliances?",
        a: "Absolutely. We design around your existing appliances or help you choose new ones.",
      },
    ],
    timeline: "4-6 weeks",
    materials: [
      "Oak",
      "Walnut",
      "Painted MDF",
      "High Gloss",
      "Matt Lacquer",
      "Quartz",
      "Granite",
      "Dekton",
    ],
  },
  {
    title: "Fitted Bedrooms",
    category: "Bedrooms",
    slug: "bedrooms",
    image: BEDROOM_IMG,
    description:
      "Elegant bedroom furniture designed for comfort and functionality.",
    heroDesc:
      "Transform your bedroom into a serene retreat with bespoke fitted furniture.",
    overview:
      "Create the bedroom of your dreams with our bespoke fitted furniture. From elegant wardrobes to perfectly proportioned bedside units and dressing tables, we design spaces that feel truly personal. Every piece is crafted to maximise your space while creating a luxurious, hotel-like atmosphere.",
    features: [
      "Built-in wardrobes & storage",
      "Custom headboard designs",
      "Bedside & dressing table units",
      "Integrated lighting solutions",
      "Colour & material matching",
      "Space-maximising layouts",
      "Mirrored sliding doors",
      "Pull-down hanging rails",
      "Shoe storage solutions",
      "Jewellery drawers",
    ],
    process: [
      {
        step: "Home Visit & Design Brief",
        desc: "We assess your space, understand your storage needs, and discuss your style preferences.",
      },
      {
        step: "Bespoke Design",
        desc: "3D designs showing every detail, from internal configurations to external finishes.",
      },
      {
        step: "Precision Manufacturing",
        desc: "Each piece is manufactured to exact measurements for a perfect fit.",
      },
      {
        step: "Expert Installation",
        desc: "Professional fitting with minimal disruption, typically completed in 1-2 days.",
      },
    ],
    pricing: [
      {
        tier: "Essential",
        desc: "Smart storage with clean aesthetics",
        from: "£2,500",
        features: [
          "Hinged door wardrobes",
          "Standard internals",
          "Choice of finishes",
          "Soft-close doors",
        ],
      },
      {
        tier: "Premium",
        desc: "Enhanced storage with premium finishes",
        from: "£5,000",
        features: [
          "Sliding door options",
          "LED lighting",
          "Pull-out accessories",
          "Mirror panels",
          "Custom headboard",
        ],
      },
      {
        tier: "Luxury",
        desc: "Complete bedroom transformation",
        from: "£10,000",
        features: [
          "Walk-in wardrobe",
          "Bespoke dressing area",
          "Full room furniture",
          "Smart lighting",
          "Integrated TV unit",
          "Automated features",
        ],
      },
    ],
    gallery: [BEDROOM_IMG],
    faqs: [
      {
        q: "Can you work with sloped ceilings?",
        a: "Yes! Fitted furniture is ideal for awkward spaces. We design around slopes and alcoves.",
      },
      {
        q: "What finishes are available?",
        a: "We offer over 100 finishes including wood grains, painted finishes, high gloss, and matt lacquer.",
      },
    ],
    timeline: "3-5 weeks",
    materials: [
      "Oak",
      "Walnut",
      "White Gloss",
      "Cashmere",
      "Graphite",
      "Mirror",
      "Fabric",
    ],
  },
  {
    title: "Media Walls",
    category: "Entertainment",
    slug: "media-walls",
    image: MEDIA_IMG,
    description:
      "Stunning media walls that become the heart of your living space.",
    heroDesc: "Create a stunning focal point with a custom-designed media wall.",
    overview:
      "Transform your living space with a bespoke media wall that integrates your TV, sound system, fireplace, and storage into one breathtaking design. Our media walls are crafted to be the centrepiece of your home, combining functionality with stunning aesthetics.",
    features: [
      "Integrated TV & sound solutions",
      "Hidden cable management",
      "Ambient LED lighting",
      "Fireplace integration",
      "Display shelving & storage",
      "Custom panel & finish choices",
      "Recessed TV mounting",
      "Bluetooth speaker integration",
      "Remote-controlled lighting",
      "Media console storage",
    ],
    process: [
      {
        step: "Design Consultation",
        desc: "We discuss your entertainment setup, room layout, and design preferences.",
      },
      {
        step: "3D Visualisation",
        desc: "See your media wall in photorealistic 3D before we build it.",
      },
      {
        step: "Build & Finish",
        desc: "Precision-built in our workshop and finished to your chosen specification.",
      },
      {
        step: "Installation & Setup",
        desc: "Professional installation including all electrical connections and media setup.",
      },
    ],
    pricing: [
      {
        tier: "Essential",
        desc: "Clean, modern TV feature wall",
        from: "£1,800",
        features: [
          "TV recess panel",
          "Cable management",
          "LED strip lighting",
          "Choice of finishes",
        ],
      },
      {
        tier: "Premium",
        desc: "Full entertainment centre",
        from: "£3,500",
        features: [
          "Electric fireplace",
          "Surround sound integration",
          "Display shelving",
          "Ambient lighting",
          "Storage units",
        ],
      },
      {
        tier: "Luxury",
        desc: "Ultimate media experience",
        from: "£7,000",
        features: [
          "Bio-ethanol fireplace",
          "Full surround sound",
          "Smart home integration",
          "Custom stone panels",
          "Motorised TV mount",
          "Hidden bar unit",
        ],
      },
    ],
    gallery: [MEDIA_IMG],
    faqs: [
      {
        q: "Can you integrate my existing fireplace?",
        a: "Yes, we can design around existing features or install new electric/bio-ethanol fireplaces.",
      },
      {
        q: "Will it support my TV size?",
        a: "We engineer our media walls to support TVs up to 85 inches safely.",
      },
    ],
    timeline: "2-4 weeks",
    materials: [
      "Slate Effect",
      "Stone Panels",
      "Wood Veneer",
      "High Gloss",
      "Concrete Effect",
      "Fabric Panels",
    ],
  },
  {
    title: "Fitted Wardrobes",
    category: "Wardrobes",
    slug: "wardrobes",
    image: WARDROBE_IMG,
    description: "Floor-to-ceiling wardrobes maximising every inch of space.",
    heroDesc: "Maximise every inch with floor-to-ceiling fitted wardrobes.",
    overview:
      "Our fitted wardrobes are designed around your exact wardrobe needs with intelligent internal configurations. From sliding doors to walk-in designs, we maximise every centimetre of space while creating a beautiful, organised storage solution.",
    features: [
      "Sliding or hinged door options",
      "Internal drawer systems",
      "Shoe racks & accessory storage",
      "Soft-close mechanisms",
      "Mirror & glass panel options",
      "Walk-in configurations",
      "Pull-down hanging rails",
      "Trouser press rails",
      "Integrated jewellery drawers",
      "Touch-activated LED lighting",
    ],
    process: [
      {
        step: "Space Assessment",
        desc: "We measure your space precisely and discuss your storage requirements in detail.",
      },
      {
        step: "Internal Configuration",
        desc: "Design the perfect layout: hanging space, shelves, drawers, and accessories.",
      },
      {
        step: "Door & Finish Selection",
        desc: "Choose from sliding, hinged, or bi-fold doors in over 50 finishes.",
      },
      {
        step: "Fitting",
        desc: "Our expert fitters install your wardrobe seamlessly, usually in just 1 day.",
      },
    ],
    pricing: [
      {
        tier: "Essential",
        desc: "Efficient storage made beautiful",
        from: "£1,500",
        features: [
          "Hinged doors",
          "Standard internals",
          "Hanging & shelving",
          "Soft-close",
        ],
      },
      {
        tier: "Premium",
        desc: "Smart storage with style",
        from: "£3,000",
        features: [
          "Sliding doors",
          "Internal drawers",
          "LED lighting",
          "Shoe rack",
          "Mirror panels",
        ],
      },
      {
        tier: "Luxury",
        desc: "Walk-in wardrobe experience",
        from: "£6,000",
        features: [
          "Walk-in design",
          "Island unit",
          "Full LED lighting",
          "Automated rails",
          "Dressing area",
          "Seating",
        ],
      },
    ],
    gallery: [WARDROBE_IMG],
    faqs: [
      {
        q: "Can you fit wardrobes in alcoves?",
        a: "Absolutely. Fitted wardrobes are perfect for making the most of alcoves and awkward spaces.",
      },
      {
        q: "How long does fitting take?",
        a: "Most single wardrobes are fitted in a single day. Larger walk-in designs may take 2 days.",
      },
    ],
    timeline: "2-4 weeks",
    materials: [
      "Oak",
      "Walnut",
      "White Gloss",
      "Mirror",
      "Glass",
      "Linen",
      "Leather Handles",
    ],
  },
];

/** Narrows a detail record to the list shape the summary surfaces consume. */
function toService(detail: ServiceDetail): Service {
  const { title, category, slug, description, image, features } = detail;
  return { title, category, slug, description, image, features };
}

/**
 * Mirrors the future `GET /content/services` endpoint. Async so the
 * eventual swap to a real `apps/api` fetch call only touches the body.
 */
export async function getServices(): Promise<Service[]> {
  return SERVICE_DETAILS.map(toService);
}

/**
 * Mirrors `GET /content/services?expand=detail` — the full records, for
 * surfaces that compare services against each other (the /services
 * specification matrix) rather than just listing them.
 */
export async function getServiceDetails(): Promise<ServiceDetail[]> {
  return SERVICE_DETAILS;
}

/** Mirrors `GET /content/services/:slug`. Returns null for unknown slugs. */
export async function getService(slug: string): Promise<ServiceDetail | null> {
  return SERVICE_DETAILS.find((service) => service.slug === slug) ?? null;
}

/**
 * Slugs known at build time, for generateStaticParams. Synchronous because
 * Next walks the build graph before any request context exists; once this
 * data comes from the API this becomes an `await getServiceDetails()`
 * inside the route's own generateStaticParams.
 */
export function getServiceSlugs(): string[] {
  return SERVICE_DETAILS.map((service) => service.slug);
}
