import { Link } from "react-router";
import { Handshake, MapPin, Wrench, Instagram } from "lucide-react";
import { TextRotate } from "../shared/TextRotate";
import {
  FullScreenScrollFX,
  ScrollFXSection,
} from "../shared/FullScreenScrollFX";
import { GlareCard } from "../shared/GlareCard";
import { SectionLabel } from "../shared/SectionLabel";
import { ScrollReveal } from "../shared/ScrollReveal";
import { TestimonialsColumn } from "../shared/TestimonialsColumn";
import { ImageWithFallback } from "../figma/ImageWithFallback";

const HERO_KITCHEN = "/centeredKitchen.jpeg";
const HERO_BEDROOM = "/Bedroom.jpeg";
const HERO_MEDIA = "/fireplaceMediawall.jpeg";
const HERO_WARDROBE = "/Wardrobes.jpeg";
const KITCHEN_IMG =
  "https://images.unsplash.com/photo-1771627278637-10eb2e9857b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmaXR0ZWQlMjBraXRjaGVuJTIwZGFyayUyMGRyYW1hdGljJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzcyMzk4MjMwfDA&ixlib=rb-4.1.0&q=80&w=1080";
const BEDROOM_IMG =
  "https://images.unsplash.com/photo-1709544345907-ceea96cb69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXNwb2tlJTIwZml0dGVkJTIwYmVkcm9vbSUyMHdhcm0lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzIzOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080";
const MEDIA_IMG =
  "https://images.unsplash.com/photo-1764344814733-930223ac186c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRlcnRhaW5tZW50JTIwY2VudGVyJTIwbWVkaWElMjB3YWxsJTIwbW9kZXJufGVufDF8fHx8MTc3MjM5ODIzN3ww&ixlib=rb-4.1.0&q=80&w=1080";
const WARDROBE_IMG =
  "https://images.unsplash.com/photo-1722942432154-067a239bc58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXR0ZWQlMjB3YXJkcm9iZSUyMHdhbGstaW4lMjBjbG9zZXQlMjBsdXh1cnl8ZW58MXx8fHwxNzcyMzk4MjMyfDA&ixlib=rb-4.1.0&q=80&w=1080";
const CTA_BG =
  "https://images.unsplash.com/photo-1765434669956-afcd50058d69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBiZWRyb29tJTIwaW50ZXJpb3IlMjB3YXJtfGVufDF8fHx8MTc3MjM5ODIzZF8w&ixlib=rb-4.1.0&q=80&w=1080";
const LIVING_IMG =
  "https://images.unsplash.com/photo-1763647972062-5e9cd48fb282?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBsaXZpbmclMjByb29tJTIwaW50ZXJpb3IlMjB3YXJtfGVufDF8fHx8MTc3MjM5ODIzOHww&ixlib=rb-4.1.0&q=80&w=1080";
const SAGE_KITCHEN =
  "https://images.unsplash.com/photo-1721522282337-6b6d3e366463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBraXRjaGVuJTIwc2FnZSUyMGdyZWVuJTIwZml0dGVkfGVufDF8fHx8MTc3MjM5ODIzMnww&ixlib=rb-4.1.0&q=80&w=1080";

const services = [
  {
    title: "Bespoke Kitchens",
    category: "Kitchens",
    description:
      "Handcrafted kitchen designs tailored to your lifestyle and space.",
    image: KITCHEN_IMG,
  },
  {
    title: "Fitted Bedrooms",
    category: "Bedrooms",
    description:
      "Elegant bedroom furniture designed for comfort and functionality.",
    image: BEDROOM_IMG,
  },
  {
    title: "Media Walls",
    category: "Entertainment",
    description:
      "Stunning media walls that become the heart of your living space.",
    image: MEDIA_IMG,
  },
  {
    title: "Fitted Wardrobes",
    category: "Wardrobes",
    description: "Floor-to-ceiling wardrobes maximising every inch of space.",
    image: WARDROBE_IMG,
  },
];

const testimonials = [
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

const instagramImages = [
  KITCHEN_IMG,
  BEDROOM_IMG,
  MEDIA_IMG,
  WARDROBE_IMG,
  SAGE_KITCHEN,
  LIVING_IMG,
];

const heroTitle = (
  <div className="flex flex-col items-center gap-5 text-center">
    <span className="text-[#8A9E8C] text-[11px] md:text-[13px] uppercase tracking-[0.3em]">
      Leicestershire's Bespoke Interior Specialists
    </span>
    <div
      className="text-[#F2F0EB] font-[Cormorant_Garamond] flex flex-wrap items-center justify-center gap-2"
      style={{
        fontSize: "clamp(2.8rem, 7vw, 6rem)",
        lineHeight: 1.05,
        fontWeight: 400,
      }}
    >
      <span>Crafting Bespoke </span>
      <TextRotate
        texts={["Kitchens", "Bedrooms", "Wardrobes", "Media Walls", "Spaces"]}
        mainClassName="text-[#F2F0EB] px-2 sm:px-3 bg-[#1C4A3A]/60 overflow-hidden py-1 sm:py-1.5 justify-center rounded-lg backdrop-blur-sm"
        staggerFrom="last"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "-120%" }}
        staggerDuration={0.025}
        splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1"
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        rotationInterval={2000}
      />
    </div>
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
      <Link
        to="/booking"
        className="px-8 py-3.5 rounded-full bg-[#1C4A3A] text-[#F2F0EB] text-[14px] tracking-wide hover:bg-[#3D6347] transition-all duration-300 hover:-translate-y-0.5 border border-[#3D6347]"
      >
        Book a Free Consultation
      </Link>
      <Link
        to="/portfolio"
        className="px-8 py-3.5 rounded-full border border-[#F2F0EB]/40 text-[#F2F0EB] text-[14px] tracking-wide hover:bg-[#F2F0EB]/10 transition-all duration-300"
      >
        View Our Work
      </Link>
    </div>
  </div>
);

const heroSections: ScrollFXSection[] = [
  {
    leftLabel: "Kitchens",
    rightLabel: "01 / Kitchens",
    background: HERO_KITCHEN,
  },
  {
    leftLabel: "Bedrooms",
    rightLabel: "02 / Bedrooms",
    background: HERO_BEDROOM,
  },
  {
    leftLabel: "Entertainment",
    rightLabel: "03 / Entertainment",
    background: HERO_MEDIA,
  },
  {
    leftLabel: "Wardrobes",
    rightLabel: "04 / Wardrobes",
    background: HERO_WARDROBE,
  },
];

export function HomePage() {
  return (
    <div>
      <HeroScrollFX />
      <ServicesSection />
      <ProcessSection />
      <WhyEnzoSection />
      <PortfolioPreview />
      <TestimonialsSection />
      <BookingCTA />
      <InstagramSection />
    </div>
  );
}

function HeroScrollFX() {
  return (
    <FullScreenScrollFX
      sections={heroSections}
      centerContent={heroTitle}
      showProgress
      durations={{ change: 0.7, snap: 800 }}
    />
  );
}

function ServicesSection() {
  return (
    <section className="py-24 md:py-32 bg-[#F2F0EB]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <ScrollReveal>
          <SectionLabel text="Our Services" />
          <h2
            className="text-center text-[#1C4A3A] mt-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
          >
            Everything. Beautifully Made.
          </h2>
          <p className="text-center text-[#6B6B65] mt-4 max-w-xl mx-auto text-[16px]">
            From initial concept to final installation, we handle every detail.
          </p>
        </ScrollReveal>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service, i) => (
            <ScrollReveal key={service.title} delay={i * 0.1}>
              <GlareCard {...service} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  const steps = [
    {
      num: "01",
      title: "Consultation",
      desc: "We visit your home, discuss your vision, and take measurements.",
    },
    {
      num: "02",
      title: "Design & Approval",
      desc: "We create 3D designs for your review and refine until perfect.",
    },
    {
      num: "03",
      title: "Installation",
      desc: "Our expert team installs everything to the highest standard.",
    },
  ];

  return (
    <section className="py-24 md:py-32 bg-[#EAE7E0]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <ScrollReveal>
          <SectionLabel text="Our Process" />
          <h2
            className="text-center text-[#1C4A3A] mt-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            How It Works
          </h2>
        </ScrollReveal>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-px bg-[#C4B8A8]" />
          {steps.map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 0.15}>
              <div className="text-center relative">
                <div className="w-12 h-12 rounded-full bg-[#1C4A3A] text-[#F2F0EB] flex items-center justify-center mx-auto text-[14px] font-[Cormorant_Garamond] relative z-10">
                  {step.num}
                </div>
                <h3
                  className="text-[#1C4A3A] mt-6"
                  style={{ fontSize: "1.3rem" }}
                >
                  {step.title}
                </h3>
                <p className="text-[#6B6B65] text-[14px] mt-2 max-w-xs mx-auto">
                  {step.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyEnzoSection() {
  return (
    <section className="py-24 md:py-32 bg-[#1C4A3A]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <ScrollReveal>
          <SectionLabel text="Why Choose Us" light />
          <h2
            className="text-[#F2F0EB] mt-4 text-center"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            A Different Kind of Interior Company.
          </h2>
        </ScrollReveal>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ScrollReveal className="md:col-span-2 md:row-span-2">
            <div className="relative h-full min-h-[300px] rounded-2xl overflow-hidden">
              <ImageWithFallback
                src={SAGE_KITCHEN}
                alt="Bespoke manufacturing"
                className="w-full h-full object-cover absolute inset-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="relative z-10 h-full flex flex-col justify-end p-8">
                <h3 className="text-[#F2F0EB]" style={{ fontSize: "1.6rem" }}>
                  Bespoke Manufacturing
                </h3>
                <p className="text-[#F2F0EB]/80 mt-2 text-[14px] max-w-sm">
                  Every piece is designed and manufactured to your exact
                  specifications.
                </p>
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="rounded-2xl bg-[#8A9E8C]/20 border border-[#2A5A4A] p-8 h-full flex flex-col justify-between min-h-[180px]">
              <Handshake size={32} className="text-[#8A9E8C]" />
              <div>
                <h4
                  className="text-[#F2F0EB] mt-4"
                  style={{ fontSize: "1.1rem" }}
                >
                  Free Consultation
                </h4>
                <p className="text-[#8A9E8C] text-[13px] mt-1">
                  We come to you. No obligation.
                </p>
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <div className="rounded-2xl bg-[#FAFAF7] p-8 h-full flex flex-col justify-between min-h-[180px]">
              <MapPin size={32} className="text-[#1C4A3A]" />
              <div>
                <h4
                  className="text-[#1C4A3A] mt-4"
                  style={{ fontSize: "1.1rem" }}
                >
                  Leicester Based
                </h4>
                <p className="text-[#6B6B65] text-[13px] mt-1">
                  Proudly serving Leicestershire.
                </p>
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <div className="rounded-2xl bg-[#2A5A4A] border border-[#3D6347] p-8 flex flex-col items-center justify-center min-h-[180px]">
              <span
                className="font-[Cormorant_Garamond] text-[#F2F0EB]"
                style={{ fontSize: "4rem", fontWeight: 300 }}
              >
                100%
              </span>
              <p className="text-[#8A9E8C] text-[13px] mt-2">
                Client Satisfaction
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.25}>
            <div className="rounded-2xl bg-[#1C4A3A] border border-[#2A5A4A] p-8 h-full flex flex-col justify-between min-h-[180px]">
              <Wrench size={32} className="text-[#8A9E8C]" />
              <div>
                <h4
                  className="text-[#F2F0EB] mt-4"
                  style={{ fontSize: "1.1rem" }}
                >
                  Installed by Experts
                </h4>
                <p className="text-[#8A9E8C] text-[13px] mt-1">
                  Our skilled team handles every detail.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function PortfolioPreview() {
  const portfolioImages = [
    KITCHEN_IMG,
    BEDROOM_IMG,
    MEDIA_IMG,
    WARDROBE_IMG,
    SAGE_KITCHEN,
    LIVING_IMG,
  ];
  return (
    <section className="py-24 md:py-32 bg-[#F2F0EB]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <ScrollReveal>
          <SectionLabel text="Our Work" />
          <h2
            className="text-center text-[#1C4A3A] mt-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
          >
            Spaces We've Transformed.
          </h2>
        </ScrollReveal>
        <div className="mt-12 columns-1 md:columns-2 lg:columns-3 gap-4">
          {portfolioImages.map((img, i) => (
            <ScrollReveal key={i} delay={i * 0.05}>
              <div className="mb-4 break-inside-avoid group relative rounded-xl overflow-hidden cursor-pointer">
                <ImageWithFallback
                  src={img}
                  alt={`Portfolio ${i + 1}`}
                  className="w-full object-cover rounded-xl"
                  style={{
                    height:
                      i % 3 === 0 ? "350px" : i % 3 === 1 ? "280px" : "320px",
                  }}
                />
                <div className="absolute inset-0 bg-[#1C4A3A]/0 group-hover:bg-[#1C4A3A]/60 transition-all duration-500 flex items-end p-6">
                  <span className="text-[#F2F0EB] text-[15px] opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                    View Project &rarr;
                  </span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal className="text-center mt-12">
          <Link
            to="/portfolio"
            className="inline-flex items-center px-8 py-3 rounded-full border border-[#1C4A3A] text-[#1C4A3A] text-[14px] tracking-wide hover:bg-[#1C4A3A] hover:text-[#F2F0EB] transition-all duration-300"
          >
            View All Projects &rarr;
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const col1 = testimonials.slice(0, 3);
  const col2 = testimonials.slice(3, 6);
  const col3 = testimonials.slice(6, 9);

  return (
    <section className="py-24 md:py-32 bg-[#FAFAF7] overflow-hidden relative">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <ScrollReveal>
          <div className="flex justify-center mb-5">
            <div className="border border-[#C4B8A8] py-1 px-4 rounded-lg text-[#8A9E8C] text-[13px]">
              Client Stories
            </div>
          </div>
          <h2
            className="text-center text-[#1C4A3A] mt-2"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            What Our Clients Say.
          </h2>
          <p className="text-center text-[#6B6B65] mt-4 text-[15px]">
            See what our customers have to say about us.
          </p>
        </ScrollReveal>

        <div
          className="flex justify-center gap-6 mt-10 max-h-[740px] overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
          }}
        >
          <TestimonialsColumn testimonials={col1} duration={15} />
          <TestimonialsColumn
            testimonials={col2}
            duration={19}
            reverse
            className="hidden md:block"
          />
          <TestimonialsColumn
            testimonials={col3}
            duration={17}
            className="hidden lg:block"
          />
        </div>
      </div>
    </section>
  );
}

function BookingCTA() {
  return (
    <section className="relative py-32 md:py-40 overflow-hidden">
      <div className="absolute inset-0">
        <ImageWithFallback
          src={CTA_BG}
          alt="Interior"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/65" />
      </div>
      <div className="relative z-10 text-center px-6">
        <ScrollReveal>
          <h2
            className="text-[#F2F0EB]"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            Ready to transform your space?
          </h2>
          <p className="text-[#F2F0EB]/70 mt-4 text-[16px] md:text-[18px] max-w-md mx-auto">
            Book a free consultation — no pressure, no obligation
          </p>
          <Link
            to="/booking"
            className="inline-flex items-center mt-10 px-10 py-4 rounded-full border-2 border-[#F2F0EB] text-[#F2F0EB] text-[15px] tracking-wide hover:bg-[#F2F0EB] hover:text-[#1C4A3A] transition-all duration-300"
          >
            Book a Slot &rarr;
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}

function InstagramSection() {
  return (
    <section className="py-20 bg-[#F2F0EB]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <ScrollReveal>
          <h2
            className="text-center text-[#1C4A3A]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)" }}
          >
            Follow Our Journey
          </h2>
          <p className="text-center text-[#8A9E8C] text-[14px] mt-2">
            @enzo.interiors
          </p>
        </ScrollReveal>
        <div className="mt-10 grid grid-cols-3 md:grid-cols-6 gap-2">
          {instagramImages.map((img, i) => (
            <ScrollReveal key={i} delay={i * 0.05}>
              <a
                href="https://instagram.com/enzo.interiors"
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer block"
              >
                <ImageWithFallback
                  src={img}
                  alt={`Instagram ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-[#1C4A3A]/0 group-hover:bg-[#1C4A3A]/60 transition-all duration-300 flex items-center justify-center">
                  <Instagram
                    size={24}
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                </div>
              </a>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
