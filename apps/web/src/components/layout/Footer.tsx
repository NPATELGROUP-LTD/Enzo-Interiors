"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MessageCircle, MapPin, Phone, Mail } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/Button";
import { FacebookIcon, InstagramIcon } from "@/components/shared/icons";

gsap.registerPlugin(ScrollTrigger);

const serviceLinks = [
  { label: "Bespoke Kitchens", path: "/services" },
  { label: "Fitted Bedrooms", path: "/services" },
  { label: "Media Walls", path: "/services" },
  { label: "Fitted Wardrobes", path: "/services" },
];

const companyLinks = [
  { label: "About Us", path: "/about" },
  { label: "Our Portfolio", path: "/portfolio" },
  { label: "Contact", path: "/contact" },
  { label: "Book a Consultation", path: "/booking" },
];

// SVG Text Hover Effect inspired by 21st.dev hover-footer
function TextHoverEffect({ text, className = "" }: { text: string; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState(false);
  const [maskPos, setMaskPos] = useState({ cx: "50%", cy: "50%" });

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMaskPos({ cx: `${x}%`, cy: `${y}%` });
  }, []);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 900 300"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
      className={`select-none cursor-default ${className}`}
    >
      <defs>
        <linearGradient id="textGradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="900" y2="300">
          <stop offset="0%" stopColor="#1C4A3A" />
          <stop offset="30%" stopColor="#8A9E8C" />
          <stop offset="60%" stopColor="#3D6347" />
          <stop offset="100%" stopColor="#D4C9B5" />
        </linearGradient>
        <radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r={hovered ? "30%" : "0%"}
          cx={maskPos.cx}
          cy={maskPos.cy}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id="textMask">
          <rect x="0" y="0" width="100%" height="100%" fill="url(#revealMask)" />
        </mask>
      </defs>

      <text
        x="50%"
        y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.5"
        className="fill-transparent"
        stroke="#2A5A4A"
        strokeOpacity={0.08}
        style={{ fontFamily: "var(--font-heading)", fontSize: "180px", fontWeight: 700 }}
      >
        {text}
      </text>

      <text
        x="50%"
        y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.5"
        className="fill-transparent"
        stroke="url(#textGradient)"
        strokeOpacity={0.5}
        mask="url(#textMask)"
        style={{ fontFamily: "var(--font-heading)", fontSize: "180px", fontWeight: 700 }}
      >
        {text}
      </text>
    </svg>
  );
}

function FooterBackgroundGradient() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute bottom-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 opacity-20 blur-[120px]"
        style={{
          background: "radial-gradient(ellipse at center, #1C4A3A 0%, #3D6347 40%, transparent 70%)",
        }}
      />
    </div>
  );
}

export function Footer() {
  const [newsletter, setNewsletter] = useState("");
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const tween = gsap.fromTo(
      footer,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: footer, start: "top 92%", once: true },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletter) {
      toast.success(`Thank you for subscribing with ${newsletter}`);
      setNewsletter("");
    }
  };

  return (
    <footer
      ref={footerRef}
      className="relative overflow-hidden rounded-t-3xl bg-enzo-footer-dark"
      style={{ opacity: 0 }}
    >
      <FooterBackgroundGradient />

      <div className="relative z-40 mx-auto max-w-7xl p-8 md:p-14">
        <div className="grid grid-cols-1 gap-12 pb-12 md:grid-cols-3 md:gap-16">
          {/* Brand + Newsletter Column */}
          <div className="flex flex-col space-y-6">
            <div className="flex items-center space-x-2">
              <span
                className="font-serif italic text-enzo-cream"
                style={{ fontSize: "1.75rem", fontWeight: 600 }}
              >
                Enzo{" "}
                <span
                  style={{
                    fontWeight: 300,
                    fontStyle: "normal",
                    fontSize: "0.8rem",
                    letterSpacing: "0.15em",
                  }}
                >
                  INTERIORS
                </span>
              </span>
            </div>
            <p className="text-[14px] leading-relaxed text-enzo-sage/70">
              Bespoke fitted furniture, designed and handcrafted in Leicester. Every space we
              create is entirely unique.
            </p>
            <div>
              <h4 className="mb-3 text-[14px] font-semibold text-enzo-cream">Newsletter</h4>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={newsletter}
                  onChange={(e) => setNewsletter(e.target.value)}
                  placeholder="Your email"
                  className="flex-1 rounded-lg border border-enzo-footer-border bg-enzo-footer-surface px-4 py-2 text-[13px] text-enzo-cream transition-colors focus:border-enzo-sage focus:outline-none"
                  required
                />
                <Button type="submit" size="sm" className="rounded-lg">
                  Subscribe
                </Button>
              </form>
            </div>
          </div>

          {/* Services + Company Column */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="mb-6 text-[16px] font-semibold text-enzo-cream">Services</h4>
              <ul className="space-y-3">
                {serviceLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.path}
                      className="text-[14px] text-enzo-sage/70 transition-colors duration-300 hover:text-enzo-sage"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-6 text-[16px] font-semibold text-enzo-cream">Company</h4>
              <ul className="space-y-3">
                {companyLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.path}
                      className="text-[14px] text-enzo-sage/70 transition-colors duration-300 hover:text-enzo-sage"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Contact + Social Column */}
          <div>
            <h4 className="mb-6 text-[16px] font-semibold text-enzo-cream">Contact Us</h4>
            <ul className="mb-6 space-y-4">
              <li className="flex items-center gap-3">
                <Mail size={16} className="flex-shrink-0 text-enzo-sage" />
                <a
                  href="mailto:hello@enzointeriors.co.uk"
                  className="text-[14px] text-enzo-sage/70 transition-colors hover:text-enzo-sage"
                >
                  hello@enzointeriors.co.uk
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} className="flex-shrink-0 text-enzo-sage" />
                <a
                  href="tel:+441160000000"
                  className="text-[14px] text-enzo-sage/70 transition-colors hover:text-enzo-sage"
                >
                  0116 XXX XXXX
                </a>
              </li>
              <li className="flex items-center gap-3">
                <MapPin size={16} className="flex-shrink-0 text-enzo-sage" />
                <span className="text-[14px] text-enzo-sage/70">Leicester &amp; Leicestershire</span>
              </li>
            </ul>
            <div>
              <h4 className="mb-3 text-[14px] font-semibold text-enzo-cream">Follow Us</h4>
              <div className="flex gap-4">
                <a
                  href="https://instagram.com/enzo.interiors"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cursor="view"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-enzo-footer-border bg-enzo-footer-surface text-enzo-sage transition-all hover:border-enzo-sage hover:text-enzo-cream"
                >
                  <InstagramIcon size={18} />
                </a>
                <a
                  href="#"
                  data-cursor="view"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-enzo-footer-border bg-enzo-footer-surface text-enzo-sage transition-all hover:border-enzo-sage hover:text-enzo-cream"
                >
                  <FacebookIcon size={18} />
                </a>
                <a
                  href="#"
                  data-cursor="view"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-enzo-footer-border bg-enzo-footer-surface text-enzo-sage transition-all hover:border-enzo-sage hover:text-enzo-cream"
                >
                  <MessageCircle size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>

        <hr className="my-8 border-t border-enzo-footer-border" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between space-y-4 text-[13px] md:flex-row md:space-y-0">
          <p className="text-enzo-sage/70">
            &copy; {new Date().getFullYear()} Enzo Interiors. All rights reserved.
          </p>
          <div className="flex gap-6 text-[12px] text-enzo-sage/70">
            <a href="#" className="transition-colors hover:text-enzo-sage">
              Privacy Policy
            </a>
            <a href="#" className="transition-colors hover:text-enzo-sage">
              Terms of Service
            </a>
          </div>
        </div>
      </div>

      {/* Text hover effect */}
      <div className="relative z-50 -mb-28 -mt-44 hidden h-[22rem] lg:flex">
        <TextHoverEffect text="ENZO" />
      </div>
    </footer>
  );
}
