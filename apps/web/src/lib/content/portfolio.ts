import type { PortfolioItem } from "./types";

// Ported verbatim from Boilerplate:src/app/components/pages/PortfolioPage.tsx's
// `projects` const. The Portfolio page itself is a separate batch, but the
// data is typed and exported here now since it lives in the same source
// shape as services/testimonials.
const PORTFOLIO_ITEMS: PortfolioItem[] = [
  {
    id: 1,
    title: "Modern Sage Kitchen",
    category: "Kitchens",
    image:
      "https://images.unsplash.com/photo-1721522282337-6b6d3e366463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBraXRjaGVuJTIwc2FnZSUyMGdyZWVuJTIwZml0dGVkfGVufDF8fHx8MTc3MjM5ODIzMnww&ixlib=rb-4.1.0&q=80&w=1080",
    location: "Oadby",
    client: "Sarah & Mark Thompson",
    duration: "5 weeks",
    year: "2025",
    desc: "A stunning sage green kitchen featuring handleless cabinetry, quartz worktops, and integrated Bosch appliances. The design maximises the open-plan layout with a large island unit perfect for entertaining.",
    materials: [
      "Sage painted MDF",
      "Quartz worktops",
      "Brass hardware",
      "Integrated LED lighting",
    ],
  },
  {
    id: 2,
    title: "Master Bedroom Suite",
    category: "Bedrooms",
    image:
      "https://images.unsplash.com/photo-1709544345907-ceea96cb69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXNwb2tlJTIwZml0dGVkJTIwYmVkcm9vbSUyMHdhcm0lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzIzOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    location: "Stoneygate",
    client: "James & Lisa Mitchell",
    duration: "4 weeks",
    year: "2025",
    desc: "A luxurious master bedroom with floor-to-ceiling fitted wardrobes, custom headboard with integrated reading lights, and matching bedside units. The warm oak finish creates an inviting sanctuary.",
    materials: [
      "Natural oak veneer",
      "Cashmere lacquer",
      "Brass pulls",
      "Fabric headboard",
    ],
  },
  {
    id: 3,
    title: "Entertainment Media Wall",
    category: "Media Walls",
    image:
      "https://images.unsplash.com/photo-1764344814733-930223ac186c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRlcnRhaW5tZW50JTIwY2VudGVyJTIwbWVkaWElMjB3YWxsJTIwbW9kZXJufGVufDF8fHx8MTc3MjM5ODIzN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    location: "Clarendon Park",
    client: "Emma & Tom Richardson",
    duration: "3 weeks",
    year: "2025",
    desc: "A striking media wall featuring a 75-inch recessed TV, electric fireplace, ambient LED strips, and hidden cable management. The matt anthracite finish gives a contemporary, cinema-like feel.",
    materials: [
      "Matt anthracite panels",
      "LED strip lighting",
      "Electric fireplace insert",
      "Acoustic fabric",
    ],
  },
  {
    id: 4,
    title: "Walk-in Wardrobe",
    category: "Wardrobes",
    image:
      "https://images.unsplash.com/photo-1722942432154-067a239bc58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXR0ZWQlMjB3YXJkcm9iZSUyMHdhbGstaW4lMjBjbG9zZXQlMjBsdXh1cnl8ZW58MXx8fHwxNzcyMzk4MjMyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    location: "Knighton",
    client: "David & Sophie Chen",
    duration: "3 weeks",
    year: "2026",
    desc: "A beautifully organised walk-in wardrobe with dedicated zones for each type of clothing. Features include pull-down hanging rails, illuminated shoe storage, and a jewellery island.",
    materials: [
      "White gloss laminate",
      "Mirror panels",
      "Chrome fittings",
      "Touch-LED lighting",
    ],
  },
  {
    id: 5,
    title: "Dark Luxury Kitchen",
    category: "Kitchens",
    image:
      "https://images.unsplash.com/photo-1765766601532-90e9b96320c8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBpbnRlcmlvciUyMGRlc2lnbiUyMGRhcmslMjBtb29keSUyMGtpdGNoZW58ZW58MXx8fHwxNzcyMzk4MjMzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    location: "Groby",
    client: "Michael Ford",
    duration: "6 weeks",
    year: "2025",
    desc: "A dramatic dark kitchen with charcoal cabinetry, Dekton worktops, and gold-accented hardware. The moody palette is balanced with under-cabinet lighting and a skylight.",
    materials: [
      "Charcoal painted oak",
      "Dekton worktops",
      "Brushed gold hardware",
      "Smoked glass splashback",
    ],
  },
  {
    id: 6,
    title: "Contemporary Bedroom",
    category: "Bedrooms",
    image:
      "https://images.unsplash.com/photo-1765434669956-afcd50058d69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBiZWRyb29tJTIwaW50ZXJpb3IlMjB3YXJtJTIwdG9uZXN8ZW58MXx8fHwxNzcyMzk4MjMzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    location: "Wigston",
    client: "Rachel Adams",
    duration: "3 weeks",
    year: "2025",
    desc: "A clean, contemporary bedroom with built-in wardrobes that disappear into the wall. The warm white palette with walnut accents creates a calming, minimalist retreat.",
    materials: [
      "Matt white lacquer",
      "American walnut accents",
      "Soft-close mechanisms",
      "Concealed handles",
    ],
  },
  {
    id: 7,
    title: "Classic Fitted Kitchen",
    category: "Kitchens",
    image:
      "https://images.unsplash.com/photo-1771627278637-10eb2e9857b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmaXR0ZWQlMjBraXRjaGVuJTIwZGFyayUyMGRyYW1hdGljJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzcyMzk4MjMwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    location: "Birstall",
    client: "Tom Bailey",
    duration: "5 weeks",
    year: "2024",
    desc: "A timeless Shaker-style kitchen in a rich deep green. Featuring Belfast sink, marble worktops, and open shelving for a classic yet functional design.",
    materials: [
      "Painted Shaker doors",
      "Carrara marble worktops",
      "Antique brass cup handles",
      "Open timber shelving",
    ],
  },
  {
    id: 8,
    title: "Living Room Redesign",
    category: "Media Walls",
    image:
      "https://images.unsplash.com/photo-1763647972062-5e9cd48fb282?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBsaXZpbmclMjByb29tJTIwaW50ZXJpb3IlMjB3YXJtfGVufDF8fHx8MTc3MjM5ODIzOHww&ixlib=rb-4.1.0&q=80&w=1080",
    location: "Evington",
    client: "Priya & Raj Patel",
    duration: "2 weeks",
    year: "2025",
    desc: "A complete living room transformation featuring a full-width media wall with integrated bio-ethanol fireplace, floating shelves, and hidden storage for games consoles.",
    materials: [
      "Porcelain stone panels",
      "Bio-ethanol fireplace",
      "Floating oak shelves",
      "Concealed storage",
    ],
  },
  {
    id: 9,
    title: "Luxury Ensuite",
    category: "Bedrooms",
    image:
      "https://images.unsplash.com/photo-1572742482459-e04d6cfdd6f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBiYXRocm9vbSUyMGludGVyaW9yJTIwbWFyYmxlfGVufDF8fHx8MTc3MjM3MTAwOHww&ixlib=rb-4.1.0&q=80&w=1080",
    location: "Market Harborough",
    client: "Laura Harrison",
    duration: "4 weeks",
    year: "2025",
    desc: "A hotel-inspired ensuite bedroom and bathroom combination featuring bespoke vanity units, walk-in shower enclosure, and matching bedroom furniture in a calming stone palette.",
    materials: [
      "Polished marble tiles",
      "Bespoke vanity unit",
      "Chrome fittings",
      "Stone-effect porcelain",
    ],
  },
];

/**
 * Mirrors the future `GET /content/portfolio` endpoint. Async so the
 * eventual swap to a real `apps/api` fetch call only touches the body.
 */
export async function getPortfolioItems(): Promise<PortfolioItem[]> {
  return PORTFOLIO_ITEMS;
}
