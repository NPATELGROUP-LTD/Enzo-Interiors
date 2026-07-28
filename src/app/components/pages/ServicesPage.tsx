import { Link } from "react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { ScrollReveal } from "../shared/ScrollReveal";
import { SectionLabel } from "../shared/SectionLabel";
import { ImageWithFallback } from "../figma/ImageWithFallback";

const KITCHEN_IMG = "https://images.unsplash.com/photo-1771627278637-10eb2e9857b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmaXR0ZWQlMjBraXRjaGVuJTIwZGFyayUyMGRyYW1hdGljJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzcyMzk4MjMwfDA&ixlib=rb-4.1.0&q=80&w=1080";
const BEDROOM_IMG = "https://images.unsplash.com/photo-1709544345907-ceea96cb69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXNwb2tlJTIwZml0dGVkJTIwYmVkcm9vbSUyMHdhcm0lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzIzOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080";
const MEDIA_IMG = "https://images.unsplash.com/photo-1764344814733-930223ac186c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRlcnRhaW5tZW50JTIwY2VudGVyJTIwbWVkaWElMjB3YWxsJTIwbW9kZXJufGVufDF8fHx8MTc3MjM5ODIzN3ww&ixlib=rb-4.1.0&q=80&w=1080";
const WARDROBE_IMG = "https://images.unsplash.com/photo-1722942432154-067a239bc58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXR0ZWQlMjB3YXJkcm9iZSUyMHdhbGstaW4lMjBjbG9zZXQlMjBsdXh1cnl8ZW58MXx8fHwxNzcyMzk4MjMyfDA&ixlib=rb-4.1.0&q=80&w=1080";

const serviceDetails = [
  {
    title: "Bespoke Kitchens",
    image: KITCHEN_IMG,
    description: "Our kitchens are designed from scratch to perfectly suit your lifestyle, cooking habits, and aesthetic preferences. Every cabinet, worktop, and fitting is tailored to your exact requirements.",
    features: ["Custom cabinetry & worktops", "Integrated appliance planning", "Premium handle & finish selection", "3D design visualisation", "Full project management", "5-year workmanship guarantee"],
  },
  {
    title: "Fitted Bedrooms",
    image: BEDROOM_IMG,
    description: "Transform your bedroom into a serene retreat with our bespoke fitted furniture. From elegant headboards to perfectly proportioned bedside units, we create spaces that feel truly personal.",
    features: ["Built-in wardrobes & storage", "Custom headboard designs", "Bedside & dressing table units", "Integrated lighting solutions", "Colour & material matching", "Space-maximising layouts"],
  },
  {
    title: "Media Walls",
    image: MEDIA_IMG,
    description: "Create a stunning focal point in your living space with a custom-designed media wall. Incorporating your TV, sound system, and decorative elements into one cohesive design.",
    features: ["Integrated TV & sound solutions", "Hidden cable management", "Ambient LED lighting", "Fireplace integration options", "Display shelving & storage", "Custom panel & finish choices"],
  },
  {
    title: "Fitted Wardrobes",
    image: WARDROBE_IMG,
    description: "Maximise every inch of your bedroom with our floor-to-ceiling fitted wardrobes. Designed around your wardrobe needs with intelligent internal configurations.",
    features: ["Sliding or hinged door options", "Internal drawer systems", "Shoe racks & accessory storage", "Soft-close mechanisms", "Mirror & glass panel options", "Walk-in wardrobe configurations"],
  },
];

const faqs = [
  { q: "How long does a typical project take?", a: "Most projects take between 4-8 weeks from initial consultation to final installation. This includes the design phase, manufacturing, and fitting." },
  { q: "Do you offer free consultations?", a: "Yes! We offer completely free, no-obligation home consultations. We'll visit your space, discuss your ideas, and provide expert advice." },
  { q: "What areas do you cover?", a: "We're based in Leicester and cover the whole of Leicestershire, including Oadby, Wigston, Market Harborough, Loughborough, and surrounding areas." },
  { q: "Can I choose my own materials and colours?", a: "Absolutely. We offer an extensive range of materials, colours, and finishes. We'll bring samples to your home so you can see how they look in your space." },
  { q: "Do you provide a guarantee?", a: "Yes, all our work comes with a comprehensive 5-year workmanship guarantee, giving you complete peace of mind." },
];

export function ServicesPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative h-[50vh] min-h-[400px] flex items-center justify-center bg-[#1C4A3A]">
        <div className="text-center">
          <p className="text-[#8A9E8C] text-[12px] uppercase tracking-[0.2em] mb-4">
            <Link to="/" className="hover:text-[#F2F0EB] transition-colors">Home</Link> / Services
          </p>
          <h1 className="text-[#F2F0EB]" style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)" }}>Our Services</h1>
        </div>
      </section>

      {/* Service Sections */}
      {serviceDetails.map((service, i) => (
        <section key={service.title} className={`py-24 ${i % 2 === 0 ? "bg-[#F2F0EB]" : "bg-[#FAFAF7]"}`}>
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <div className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} gap-12 items-center`}>
              <ScrollReveal className="md:w-[55%]">
                <div className="rounded-2xl overflow-hidden">
                  <ImageWithFallback src={service.image} alt={service.title} className="w-full h-[400px] md:h-[500px] object-cover" />
                </div>
              </ScrollReveal>
              <ScrollReveal className="md:w-[45%]" delay={0.15}>
                <SectionLabel text={service.title.split(" ")[1] || service.title} className="!justify-start" />
                <h2 className="text-[#1C4A3A] mt-4" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>{service.title}</h2>
                <p className="text-[#6B6B65] mt-4 text-[15px] leading-relaxed">{service.description}</p>
                <ul className="mt-6 space-y-3">
                  {service.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-[#2C2C2C] text-[14px]">
                      <Check size={16} className="text-[#1C4A3A] flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/services/${service.title === "Bespoke Kitchens" ? "kitchens" : service.title === "Fitted Bedrooms" ? "bedrooms" : service.title === "Media Walls" ? "media-walls" : "wardrobes"}`}
                  className="inline-flex items-center mt-8 px-8 py-3 rounded-full bg-[#1C4A3A] text-[#F2F0EB] text-[14px] tracking-wide hover:bg-[#3D6347] transition-all duration-300"
                >
                  View Full Details &rarr;
                </Link>
              </ScrollReveal>
            </div>
          </div>
        </section>
      ))}

      {/* FAQ */}
      <section className="py-24 bg-[#F2F0EB]">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <ScrollReveal>
            <SectionLabel text="FAQs" />
            <h2 className="text-center text-[#1C4A3A] mt-4" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
              Frequently Asked Questions
            </h2>
          </ScrollReveal>
          <div className="mt-12 space-y-4">
            {faqs.map((faq, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <FAQItem question={faq.q} answer={faq.a} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#C4B8A8] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-[#FAFAF7] transition-colors"
      >
        <span className="text-[#1C4A3A] text-[15px]" style={{ fontWeight: 500 }}>{question}</span>
        <span className={`text-[#1C4A3A] transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-[#6B6B65] text-[14px] leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}