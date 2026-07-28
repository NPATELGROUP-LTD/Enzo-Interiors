import { useState } from "react";
import { Link, useParams } from "react-router";
import { Check, Star, Clock, Ruler, Palette, ArrowRight, Phone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ScrollReveal } from "../shared/ScrollReveal";
import { SectionLabel } from "../shared/SectionLabel";
import { ImageWithFallback } from "../figma/ImageWithFallback";

const KITCHEN_IMG = "https://images.unsplash.com/photo-1771627278637-10eb2e9857b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmaXR0ZWQlMjBraXRjaGVuJTIwZGFyayUyMGRyYW1hdGljJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzcyMzk4MjMwfDA&ixlib=rb-4.1.0&q=80&w=1080";
const BEDROOM_IMG = "https://images.unsplash.com/photo-1709544345907-ceea96cb69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXNwb2tlJTIwZml0dGVkJTIwYmVkcm9vbSUyMHdhcm0lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzIzOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080";
const MEDIA_IMG = "https://images.unsplash.com/photo-1764344814733-930223ac186c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRlcnRhaW5tZW50JTIwY2VudGVyJTIwbWVkaWElMjB3YWxsJTIwbW9kZXJufGVufDF8fHx8MTc3MjM5ODIzN3ww&ixlib=rb-4.1.0&q=80&w=1080";
const WARDROBE_IMG = "https://images.unsplash.com/photo-1722942432154-067a239bc58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXR0ZWQlMjB3YXJkcm9iZSUyMHdhbGstaW4lMjBjbG9zZXQlMjBsdXh1cnl8ZW58MXx8fHwxNzcyMzk4MjMyfDA&ixlib=rb-4.1.0&q=80&w=1080";

const allServices: Record<string, {
  title: string; slug: string; image: string; heroDesc: string;
  description: string; features: string[]; process: { step: string; desc: string }[];
  pricing: { tier: string; desc: string; from: string; features: string[] }[];
  gallery: string[]; faqs: { q: string; a: string }[];
  timeline: string; materials: string[];
}> = {
  kitchens: {
    title: "Bespoke Kitchens", slug: "kitchens", image: KITCHEN_IMG,
    heroDesc: "Handcrafted kitchen designs tailored to your lifestyle, cooking habits, and aesthetic preferences.",
    description: "Our kitchens are designed from scratch to perfectly suit your home. Every cabinet, worktop, and fitting is tailored to your exact requirements. We use only premium materials and finishes, ensuring your kitchen not only looks stunning but stands the test of time. From contemporary handleless designs to classic shaker styles, we bring your vision to life.",
    features: ["Custom cabinetry & worktops", "Integrated appliance planning", "Premium handle & finish selection", "3D design visualisation", "Full project management", "5-year workmanship guarantee", "Soft-close mechanisms on all doors", "LED under-cabinet lighting", "Quartz or granite worktop options", "Bespoke island designs"],
    process: [
      { step: "Home Consultation", desc: "We visit your home, measure the space, and discuss your vision, lifestyle needs, and budget." },
      { step: "3D Design & Material Selection", desc: "Our designers create photorealistic 3D renders. Choose from hundreds of finishes, handles, and worktop materials." },
      { step: "Manufacturing", desc: "Your kitchen is precision-manufactured in our workshop to exact specifications." },
      { step: "Professional Installation", desc: "Our experienced fitters install everything to the highest standard, typically within 3-5 days." },
    ],
    pricing: [
      { tier: "Essential", desc: "Quality fitted kitchen with standard finishes", from: "£4,500", features: ["Laminate worktops", "Standard cabinetry", "Soft-close hinges", "Choice of 30+ door styles"] },
      { tier: "Premium", desc: "Elevated design with premium materials", from: "£8,000", features: ["Quartz worktops", "Premium cabinetry", "Integrated lighting", "Handleless options", "Integrated appliances"] },
      { tier: "Luxury", desc: "Fully bespoke with the finest materials", from: "£15,000", features: ["Granite/Dekton worktops", "Bespoke cabinetry", "Full LED lighting", "Smart storage solutions", "Wine cooler integration", "Boiling water tap"] },
    ],
    gallery: [KITCHEN_IMG],
    faqs: [
      { q: "How long does a kitchen installation take?", a: "Typically 4-6 weeks from design approval to completion. Installation itself takes 3-5 days." },
      { q: "Do you remove the old kitchen?", a: "Yes, we handle full removal and disposal of your existing kitchen as part of the project." },
      { q: "Can I keep my existing appliances?", a: "Absolutely. We design around your existing appliances or help you choose new ones." },
    ],
    timeline: "4-6 weeks", materials: ["Oak", "Walnut", "Painted MDF", "High Gloss", "Matt Lacquer", "Quartz", "Granite", "Dekton"],
  },
  bedrooms: {
    title: "Fitted Bedrooms", slug: "bedrooms", image: BEDROOM_IMG,
    heroDesc: "Transform your bedroom into a serene retreat with bespoke fitted furniture.",
    description: "Create the bedroom of your dreams with our bespoke fitted furniture. From elegant wardrobes to perfectly proportioned bedside units and dressing tables, we design spaces that feel truly personal. Every piece is crafted to maximise your space while creating a luxurious, hotel-like atmosphere.",
    features: ["Built-in wardrobes & storage", "Custom headboard designs", "Bedside & dressing table units", "Integrated lighting solutions", "Colour & material matching", "Space-maximising layouts", "Mirrored sliding doors", "Pull-down hanging rails", "Shoe storage solutions", "Jewellery drawers"],
    process: [
      { step: "Home Visit & Design Brief", desc: "We assess your space, understand your storage needs, and discuss your style preferences." },
      { step: "Bespoke Design", desc: "3D designs showing every detail, from internal configurations to external finishes." },
      { step: "Precision Manufacturing", desc: "Each piece is manufactured to exact measurements for a perfect fit." },
      { step: "Expert Installation", desc: "Professional fitting with minimal disruption, typically completed in 1-2 days." },
    ],
    pricing: [
      { tier: "Essential", desc: "Smart storage with clean aesthetics", from: "£2,500", features: ["Hinged door wardrobes", "Standard internals", "Choice of finishes", "Soft-close doors"] },
      { tier: "Premium", desc: "Enhanced storage with premium finishes", from: "£5,000", features: ["Sliding door options", "LED lighting", "Pull-out accessories", "Mirror panels", "Custom headboard"] },
      { tier: "Luxury", desc: "Complete bedroom transformation", from: "£10,000", features: ["Walk-in wardrobe", "Bespoke dressing area", "Full room furniture", "Smart lighting", "Integrated TV unit", "Automated features"] },
    ],
    gallery: [BEDROOM_IMG],
    faqs: [
      { q: "Can you work with sloped ceilings?", a: "Yes! Fitted furniture is ideal for awkward spaces. We design around slopes and alcoves." },
      { q: "What finishes are available?", a: "We offer over 100 finishes including wood grains, painted finishes, high gloss, and matt lacquer." },
    ],
    timeline: "3-5 weeks", materials: ["Oak", "Walnut", "White Gloss", "Cashmere", "Graphite", "Mirror", "Fabric"],
  },
  "media-walls": {
    title: "Media Walls", slug: "media-walls", image: MEDIA_IMG,
    heroDesc: "Create a stunning focal point with a custom-designed media wall.",
    description: "Transform your living space with a bespoke media wall that integrates your TV, sound system, fireplace, and storage into one breathtaking design. Our media walls are crafted to be the centrepiece of your home, combining functionality with stunning aesthetics.",
    features: ["Integrated TV & sound solutions", "Hidden cable management", "Ambient LED lighting", "Fireplace integration", "Display shelving & storage", "Custom panel & finish choices", "Recessed TV mounting", "Bluetooth speaker integration", "Remote-controlled lighting", "Media console storage"],
    process: [
      { step: "Design Consultation", desc: "We discuss your entertainment setup, room layout, and design preferences." },
      { step: "3D Visualisation", desc: "See your media wall in photorealistic 3D before we build it." },
      { step: "Build & Finish", desc: "Precision-built in our workshop and finished to your chosen specification." },
      { step: "Installation & Setup", desc: "Professional installation including all electrical connections and media setup." },
    ],
    pricing: [
      { tier: "Essential", desc: "Clean, modern TV feature wall", from: "£1,800", features: ["TV recess panel", "Cable management", "LED strip lighting", "Choice of finishes"] },
      { tier: "Premium", desc: "Full entertainment centre", from: "£3,500", features: ["Electric fireplace", "Surround sound integration", "Display shelving", "Ambient lighting", "Storage units"] },
      { tier: "Luxury", desc: "Ultimate media experience", from: "£7,000", features: ["Bio-ethanol fireplace", "Full surround sound", "Smart home integration", "Custom stone panels", "Motorised TV mount", "Hidden bar unit"] },
    ],
    gallery: [MEDIA_IMG],
    faqs: [
      { q: "Can you integrate my existing fireplace?", a: "Yes, we can design around existing features or install new electric/bio-ethanol fireplaces." },
      { q: "Will it support my TV size?", a: "We engineer our media walls to support TVs up to 85 inches safely." },
    ],
    timeline: "2-4 weeks", materials: ["Slate Effect", "Stone Panels", "Wood Veneer", "High Gloss", "Concrete Effect", "Fabric Panels"],
  },
  wardrobes: {
    title: "Fitted Wardrobes", slug: "wardrobes", image: WARDROBE_IMG,
    heroDesc: "Maximise every inch with floor-to-ceiling fitted wardrobes.",
    description: "Our fitted wardrobes are designed around your exact wardrobe needs with intelligent internal configurations. From sliding doors to walk-in designs, we maximise every centimetre of space while creating a beautiful, organised storage solution.",
    features: ["Sliding or hinged door options", "Internal drawer systems", "Shoe racks & accessory storage", "Soft-close mechanisms", "Mirror & glass panel options", "Walk-in configurations", "Pull-down hanging rails", "Trouser press rails", "Integrated jewellery drawers", "Touch-activated LED lighting"],
    process: [
      { step: "Space Assessment", desc: "We measure your space precisely and discuss your storage requirements in detail." },
      { step: "Internal Configuration", desc: "Design the perfect layout: hanging space, shelves, drawers, and accessories." },
      { step: "Door & Finish Selection", desc: "Choose from sliding, hinged, or bi-fold doors in over 50 finishes." },
      { step: "Fitting", desc: "Our expert fitters install your wardrobe seamlessly, usually in just 1 day." },
    ],
    pricing: [
      { tier: "Essential", desc: "Efficient storage made beautiful", from: "£1,500", features: ["Hinged doors", "Standard internals", "Hanging & shelving", "Soft-close"] },
      { tier: "Premium", desc: "Smart storage with style", from: "£3,000", features: ["Sliding doors", "Internal drawers", "LED lighting", "Shoe rack", "Mirror panels"] },
      { tier: "Luxury", desc: "Walk-in wardrobe experience", from: "£6,000", features: ["Walk-in design", "Island unit", "Full LED lighting", "Automated rails", "Dressing area", "Seating"] },
    ],
    gallery: [WARDROBE_IMG],
    faqs: [
      { q: "Can you fit wardrobes in alcoves?", a: "Absolutely. Fitted wardrobes are perfect for making the most of alcoves and awkward spaces." },
      { q: "How long does fitting take?", a: "Most single wardrobes are fitted in a single day. Larger walk-in designs may take 2 days." },
    ],
    timeline: "2-4 weeks", materials: ["Oak", "Walnut", "White Gloss", "Mirror", "Glass", "Linen", "Leather Handles"],
  },
};

export function ServiceDetailPage() {
  const { slug } = useParams();
  const service = allServices[slug || ""] || allServices.kitchens;
  const [quoteModal, setQuoteModal] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ name: "", email: "", phone: "", budget: "", details: "" });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Quote request submitted! We'll be in touch within 24 hours.");
    setQuoteModal(false);
    setQuoteForm({ name: "", email: "", phone: "", budget: "", details: "" });
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[500px] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback src={service.image} alt={service.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        </div>
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 pb-16 w-full">
          <p className="text-[#8A9E8C] text-[12px] uppercase tracking-[0.2em] mb-4">
            <Link to="/" className="hover:text-[#F2F0EB] transition-colors">Home</Link>
            {" / "}
            <Link to="/services" className="hover:text-[#F2F0EB] transition-colors">Services</Link>
            {" / "}{service.title}
          </p>
          <h1 className="text-[#F2F0EB]" style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)" }}>{service.title}</h1>
          <p className="text-[#F2F0EB]/70 text-[16px] md:text-[18px] mt-4 max-w-2xl">{service.heroDesc}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button onClick={() => setQuoteModal(true)} className="px-8 py-3.5 rounded-full bg-[#1C4A3A] text-[#F2F0EB] text-[14px] tracking-wide hover:bg-[#3D6347] transition-all duration-300 border border-[#3D6347]">
              Get a Free Quote &rarr;
            </button>
            <Link to="/booking" className="px-8 py-3.5 rounded-full border border-[#F2F0EB]/40 text-[#F2F0EB] text-[14px] tracking-wide hover:bg-[#F2F0EB]/10 transition-all duration-300">
              Book Consultation
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-6">
            <div className="flex items-center gap-2"><Clock size={16} className="text-[#8A9E8C]" /><span className="text-[#F2F0EB]/70 text-[13px]">{service.timeline} typical</span></div>
            <div className="flex items-center gap-2"><Ruler size={16} className="text-[#8A9E8C]" /><span className="text-[#F2F0EB]/70 text-[13px]">Free home measurement</span></div>
            <div className="flex items-center gap-2"><Star size={16} className="text-[#8A9E8C]" /><span className="text-[#F2F0EB]/70 text-[13px]">5-year guarantee</span></div>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="py-20 bg-[#F2F0EB]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row gap-16">
            <ScrollReveal className="md:w-1/2">
              <SectionLabel text="About This Service" className="!justify-start" />
              <h2 className="text-[#1C4A3A] mt-4" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>Crafted With Precision</h2>
              <p className="text-[#6B6B65] mt-6 text-[15px] leading-relaxed">{service.description}</p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {service.features.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-[#2C2C2C] text-[14px]">
                    <Check size={16} className="text-[#1C4A3A] flex-shrink-0" />{f}
                  </div>
                ))}
              </div>
            </ScrollReveal>
            <ScrollReveal className="md:w-1/2" delay={0.15}>
              <h3 className="text-[#1C4A3A] mb-6" style={{ fontSize: "1.3rem" }}>Materials & Finishes</h3>
              <div className="flex flex-wrap gap-2">
                {service.materials.map((m) => (
                  <span key={m} className="px-4 py-2 rounded-full border border-[#C4B8A8] text-[#2C2C2C] text-[13px] flex items-center gap-2">
                    <Palette size={14} className="text-[#8A9E8C]" />{m}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 bg-[#1C4A3A]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <ScrollReveal>
            <SectionLabel text="Our Process" light />
            <h2 className="text-[#F2F0EB] mt-4 text-center" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>From Vision to Reality</h2>
          </ScrollReveal>
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {service.process.map((p, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-[#F2F0EB] text-[#1C4A3A] flex items-center justify-center text-[14px] font-[Cormorant_Garamond] mb-4" style={{ fontWeight: 600 }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h4 className="text-[#F2F0EB]" style={{ fontSize: "1.1rem" }}>{p.step}</h4>
                  <p className="text-[#8A9E8C] text-[14px] mt-2 leading-relaxed">{p.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-[#FAFAF7]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <ScrollReveal>
            <SectionLabel text="Pricing" />
            <h2 className="text-center text-[#1C4A3A] mt-4" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>Investment Guide</h2>
            <p className="text-center text-[#6B6B65] mt-3 text-[15px]">Every project is unique — these are starting prices for guidance.</p>
          </ScrollReveal>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {service.pricing.map((p, i) => (
              <ScrollReveal key={p.tier} delay={i * 0.1}>
                <div className={`rounded-2xl p-8 h-full flex flex-col ${i === 1 ? "bg-[#1C4A3A] text-[#F2F0EB] ring-2 ring-[#1C4A3A] scale-[1.02]" : "bg-white border border-[#C4B8A8]/30"}`}>
                  <span className={`text-[11px] uppercase tracking-[0.2em] ${i === 1 ? "text-[#8A9E8C]" : "text-[#8A9E8C]"}`}>{p.tier}</span>
                  <h3 className={`mt-2 ${i === 1 ? "text-[#F2F0EB]" : "text-[#1C4A3A]"}`} style={{ fontSize: "1.3rem" }}>From {p.from}</h3>
                  <p className={`mt-2 text-[14px] ${i === 1 ? "text-[#F2F0EB]/70" : "text-[#6B6B65]"}`}>{p.desc}</p>
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className={`flex items-center gap-2 text-[13px] ${i === 1 ? "text-[#F2F0EB]/80" : "text-[#2C2C2C]"}`}>
                        <Check size={14} className={i === 1 ? "text-[#8A9E8C]" : "text-[#1C4A3A]"} />{f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setQuoteModal(true)}
                    className={`mt-8 w-full py-3 rounded-full text-[14px] transition-all duration-300 ${i === 1 ? "bg-[#F2F0EB] text-[#1C4A3A] hover:bg-white" : "bg-[#1C4A3A] text-[#F2F0EB] hover:bg-[#3D6347]"}`}
                  >
                    Get Quote
                  </button>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-[#F2F0EB]">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <ScrollReveal>
            <SectionLabel text="FAQs" />
            <h2 className="text-center text-[#1C4A3A] mt-4" style={{ fontSize: "clamp(1.8rem, 3vw, 2.2rem)" }}>Common Questions</h2>
          </ScrollReveal>
          <div className="mt-10 space-y-3">
            {service.faqs.map((faq, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <div className="border border-[#C4B8A8] rounded-xl overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left hover:bg-[#FAFAF7] transition-colors">
                    <span className="text-[#1C4A3A] text-[15px]" style={{ fontWeight: 500 }}>{faq.q}</span>
                    <span className={`text-[#1C4A3A] transition-transform duration-300 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                  </button>
                  {openFaq === i && <div className="px-5 pb-5"><p className="text-[#6B6B65] text-[14px] leading-relaxed">{faq.a}</p></div>}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#1C4A3A]">
        <div className="text-center px-6">
          <h2 className="text-[#F2F0EB]" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}>Ready to get started?</h2>
          <p className="text-[#8A9E8C] mt-3 text-[16px]">Get a free, no-obligation quote for your {service.title.toLowerCase()} project.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => setQuoteModal(true)} className="px-10 py-4 rounded-full bg-[#F2F0EB] text-[#1C4A3A] text-[15px] hover:bg-white transition-all duration-300">
              Get Your Free Quote
            </button>
            <a href="tel:0116XXXXXXX" className="flex items-center gap-2 px-10 py-4 rounded-full border border-[#F2F0EB]/40 text-[#F2F0EB] text-[15px] hover:bg-[#F2F0EB]/10 transition-all duration-300">
              <Phone size={16} /> Call Us
            </a>
          </div>
        </div>
      </section>

      {/* Quote Modal */}
      <AnimatePresence>
        {quoteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQuoteModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-[#1C4A3A]" style={{ fontSize: "1.3rem" }}>Get a Free Quote</h3>
                  <p className="text-[#8A9E8C] text-[13px] mt-1">{service.title}</p>
                </div>
                <button onClick={() => setQuoteModal(false)} className="text-[#6B6B65] hover:text-[#1C4A3A]">&times;</button>
              </div>
              <form onSubmit={handleQuoteSubmit} className="space-y-4">
                <div><label className="text-[#2C2C2C] text-[12px] block mb-1">Full Name</label><input required value={quoteForm.name} onChange={e => setQuoteForm({...quoteForm, name: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[14px] focus:outline-none focus:border-[#1C4A3A]" placeholder="Your name" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[#2C2C2C] text-[12px] block mb-1">Email</label><input required type="email" value={quoteForm.email} onChange={e => setQuoteForm({...quoteForm, email: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[14px] focus:outline-none focus:border-[#1C4A3A]" placeholder="you@email.com" /></div>
                  <div><label className="text-[#2C2C2C] text-[12px] block mb-1">Phone</label><input value={quoteForm.phone} onChange={e => setQuoteForm({...quoteForm, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[14px] focus:outline-none focus:border-[#1C4A3A]" placeholder="07XXX XXXXXX" /></div>
                </div>
                <div><label className="text-[#2C2C2C] text-[12px] block mb-1">Budget Range</label>
                  <select value={quoteForm.budget} onChange={e => setQuoteForm({...quoteForm, budget: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[14px] focus:outline-none focus:border-[#1C4A3A]">
                    <option value="">Select range...</option><option>Under £3,000</option><option>£3,000 - £5,000</option><option>£5,000 - £10,000</option><option>£10,000 - £20,000</option><option>£20,000+</option>
                  </select>
                </div>
                <div><label className="text-[#2C2C2C] text-[12px] block mb-1">Project Details</label><textarea required rows={4} value={quoteForm.details} onChange={e => setQuoteForm({...quoteForm, details: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[14px] focus:outline-none focus:border-[#1C4A3A] resize-none" placeholder="Tell us about your space and what you're looking for..." /></div>
                <button type="submit" className="w-full py-3.5 rounded-full bg-[#1C4A3A] text-[#F2F0EB] text-[14px] hover:bg-[#3D6347] transition-all duration-300">Submit Quote Request</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
