import type { Testimonial } from "./types";

// Ported verbatim from Boilerplate:src/app/components/pages/HomePage.tsx's
// `testimonials` const.
const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sarah Thompson",
    role: "Oadby, Leicester",
    text: "Enzo Interiors transformed our kitchen beyond our wildest dreams. The attention to detail is absolutely impeccable. Every surface, every handle, every finish is perfect.",
    image: "https://randomuser.me/api/portraits/women/1.jpg",
  },
  {
    name: "James Mitchell",
    role: "Stoneygate",
    text: "Our fitted bedroom is stunning. Oyz and the team were professional from start to finish. Couldn't recommend them enough.",
    image: "https://randomuser.me/api/portraits/men/2.jpg",
  },
  {
    name: "Emma Richardson",
    role: "Clarendon Park",
    text: "The media wall they designed is the centrepiece of our home. Friends are always amazed when they visit.",
    image: "https://randomuser.me/api/portraits/women/3.jpg",
  },
  {
    name: "David Chen",
    role: "Knighton",
    text: "From consultation to installation, the process was seamless. Our wardrobes are beautifully crafted and make incredible use of space.",
    image: "https://randomuser.me/api/portraits/men/4.jpg",
  },
  {
    name: "Rachel Adams",
    role: "Wigston",
    text: "We chose Enzo for our entire home renovation. The kitchen and bedrooms are magazine-worthy. True bespoke craftsmanship.",
    image: "https://randomuser.me/api/portraits/women/5.jpg",
  },
  {
    name: "Michael Ford",
    role: "Groby",
    text: "Outstanding service and quality. The fitted wardrobes they installed are absolutely gorgeous. Worth every penny.",
    image: "https://randomuser.me/api/portraits/men/7.jpg",
  },
  {
    name: "Priya Patel",
    role: "Evington",
    text: "Enzo created a beautiful bespoke kitchen for us. The sage green cabinets are exactly what we envisioned. Wonderful team!",
    image: "https://randomuser.me/api/portraits/women/6.jpg",
  },
  {
    name: "Tom Bailey",
    role: "Birstall",
    text: "The team at Enzo are true craftsmen. Our media wall with integrated lighting has completely changed our living room.",
    image: "https://randomuser.me/api/portraits/men/9.jpg",
  },
  {
    name: "Laura Harrison",
    role: "Market Harborough",
    text: "Professional, creative, and genuinely passionate about interiors. Our bedroom feels like a luxury hotel now.",
    image: "https://randomuser.me/api/portraits/women/8.jpg",
  },
];

/**
 * Mirrors the future `GET /content/testimonials` endpoint. Async so the
 * eventual swap to a real `apps/api` fetch call only touches the body.
 */
export async function getTestimonials(): Promise<Testimonial[]> {
  return TESTIMONIALS;
}
