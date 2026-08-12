import type { Service } from "./types";

// Ported verbatim from Boilerplate:src/app/components/pages/HomePage.tsx's
// `services` const, plus `slug` and `features` merged in from
// Boilerplate:src/app/components/pages/ServicesPage.tsx's `serviceDetails`
// const (same four services, richer per-service fields the /services list
// page needs). Image URLs are the same Unsplash sources the boilerplate
// used as placeholders — swap for real S3-backed URLs once `apps/api`'s
// `GET /content/services` endpoint exists.
const SERVICES: Service[] = [
  {
    title: "Bespoke Kitchens",
    category: "Kitchens",
    slug: "kitchens",
    description:
      "Handcrafted kitchen designs tailored to your lifestyle and space.",
    image:
      "https://images.unsplash.com/photo-1771627278637-10eb2e9857b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmaXR0ZWQlMjBraXRjaGVuJTIwZGFyayUyMGRyYW1hdGljJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzcyMzk4MjMwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    features: [
      "Custom cabinetry & worktops",
      "Integrated appliance planning",
      "Premium handle & finish selection",
      "3D design visualisation",
      "Full project management",
      "5-year workmanship guarantee",
    ],
  },
  {
    title: "Fitted Bedrooms",
    category: "Bedrooms",
    slug: "bedrooms",
    description:
      "Elegant bedroom furniture designed for comfort and functionality.",
    image:
      "https://images.unsplash.com/photo-1709544345907-ceea96cb69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXNwb2tlJTIwZml0dGVkJTIwYmVkcm9vbSUyMHdhcm0lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzIzOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    features: [
      "Built-in wardrobes & storage",
      "Custom headboard designs",
      "Bedside & dressing table units",
      "Integrated lighting solutions",
      "Colour & material matching",
      "Space-maximising layouts",
    ],
  },
  {
    title: "Media Walls",
    category: "Entertainment",
    slug: "media-walls",
    description:
      "Stunning media walls that become the heart of your living space.",
    image:
      "https://images.unsplash.com/photo-1764344814733-930223ac186c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRlcnRhaW5tZW50JTIwY2VudGVyJTIwbWVkaWElMjB3YWxsJTIwbW9kZXJufGVufDF8fHx8MTc3MjM5ODIzN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    features: [
      "Integrated TV & sound solutions",
      "Hidden cable management",
      "Ambient LED lighting",
      "Fireplace integration options",
      "Display shelving & storage",
      "Custom panel & finish choices",
    ],
  },
  {
    title: "Fitted Wardrobes",
    category: "Wardrobes",
    slug: "wardrobes",
    description: "Floor-to-ceiling wardrobes maximising every inch of space.",
    image:
      "https://images.unsplash.com/photo-1722942432154-067a239bc58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXR0ZWQlMjB3YXJkcm9iZSUyMHdhbGstaW4lMjBjbG9zZXQlMjBsdXh1cnl8ZW58MXx8fHwxNzcyMzk4MjMyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    features: [
      "Sliding or hinged door options",
      "Internal drawer systems",
      "Shoe racks & accessory storage",
      "Soft-close mechanisms",
      "Mirror & glass panel options",
      "Walk-in wardrobe configurations",
    ],
  },
];

/**
 * Mirrors the future `GET /content/services` endpoint. Async so the
 * eventual swap to a real `apps/api` fetch call only touches the body.
 */
export async function getServices(): Promise<Service[]> {
  return SERVICES;
}
