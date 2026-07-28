import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import {
  Instagram,
  Facebook,
  MessageCircle,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { motion } from "motion/react";

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

const socialIcons = [
  { Icon: Instagram, label: "Instagram", href: "#" },
  { Icon: Facebook, label: "Facebook", href: "#" },
  { Icon: MessageCircle, label: "WhatsApp", href: "#" },
];

// SVG Text Hover Effect inspired by 21st.dev hover-footer
function TextHoverEffect({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPos, setMaskPos] = useState({ cx: "50%", cy: "50%" });

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCursor({ x, y });
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
        <linearGradient
          id="textGradient"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="900"
          y2="300"
        >
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
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#revealMask)"
          />
        </mask>
      </defs>

      {/* Base text - very dim */}
      <text
        x="50%"
        y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.5"
        className="fill-transparent"
        stroke="#2A5A4A"
        strokeOpacity={0.08}
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "180px",
          fontWeight: 700,
        }}
      >
        {text}
      </text>

      {/* Hover reveal text */}
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
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "180px",
          fontWeight: 700,
        }}
      >
        {text}
      </text>
    </svg>
  );
}

function FooterBackgroundGradient() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-20 blur-[120px]"
        style={{
          background:
            "radial-gradient(ellipse at center, #1C4A3A 0%, #3D6347 40%, transparent 70%)",
        }}
      />
    </div>
  );
}

export function Footer() {
  const [newsletter, setNewsletter] = useState("");

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletter) {
      alert(`Thank you for subscribing with: ${newsletter}`);
      setNewsletter("");
    }
  };

  return (
    <footer className="relative bg-[#0F0F11] rounded-t-3xl overflow-hidden">
      <FooterBackgroundGradient />

      <div className="max-w-7xl mx-auto p-8 md:p-14 z-40 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 pb-12">
          {/* Brand + Newsletter Column */}
          <div className="flex flex-col space-y-6">
            <div className="flex items-center space-x-2">
              <span
                className="font-[Cormorant_Garamond] italic text-[#F2F0EB]"
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
            <p className="text-[#6B6B65] text-[14px] leading-relaxed">
              Bespoke fitted furniture, designed and handcrafted in Leicester.
              Every space we create is entirely unique.
            </p>
            <div>
              <h4
                className="text-[#F2F0EB] text-[14px] mb-3"
                style={{ fontWeight: 600 }}
              >
                Newsletter
              </h4>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={newsletter}
                  onChange={(e) => setNewsletter(e.target.value)}
                  placeholder="Your email"
                  className="flex-1 px-4 py-2 rounded-lg bg-[#1A1A1C] border border-[#2A2A28] text-[#F2F0EB] text-[13px] focus:outline-none focus:border-[#8A9E8C] transition-colors"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1C4A3A] text-[#F2F0EB] text-[13px] hover:bg-[#3D6347] transition-colors"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>

          {/* Services + Company Column */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4
                className="text-[#F2F0EB] text-[16px] mb-6"
                style={{ fontWeight: 600 }}
              >
                Services
              </h4>
              <ul className="space-y-3">
                {serviceLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      className="text-[#6B6B65] text-[14px] hover:text-[#8A9E8C] transition-colors duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4
                className="text-[#F2F0EB] text-[16px] mb-6"
                style={{ fontWeight: 600 }}
              >
                Company
              </h4>
              <ul className="space-y-3">
                {companyLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      className="text-[#6B6B65] text-[14px] hover:text-[#8A9E8C] transition-colors duration-300"
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
            <h4
              className="text-[#F2F0EB] text-[16px] mb-6"
              style={{ fontWeight: 600 }}
            >
              Contact Us
            </h4>
            <ul className="space-y-4 mb-6">
              <li className="flex items-center gap-3">
                <Mail size={16} className="text-[#8A9E8C] flex-shrink-0" />
                <a
                  href="mailto:hello@enzointeriors.co.uk"
                  className="text-[#6B6B65] text-[14px] hover:text-[#8A9E8C] transition-colors"
                >
                  hello@enzointeriors.co.uk
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-[#8A9E8C] flex-shrink-0" />
                <a
                  href="tel:+441160000000"
                  className="text-[#6B6B65] text-[14px] hover:text-[#8A9E8C] transition-colors"
                >
                  0116 XXX XXXX
                </a>
              </li>
              <li className="flex items-center gap-3">
                <MapPin size={16} className="text-[#8A9E8C] flex-shrink-0" />
                <span className="text-[#6B6B65] text-[14px]">
                  Leicester & Leicestershire
                </span>
              </li>
            </ul>
            <div>
              <h4
                className="text-[#F2F0EB] text-[14px] mb-3"
                style={{ fontWeight: 600 }}
              >
                Follow Us
              </h4>
              <div className="flex gap-4">
                <a
                  href="https://instagram.com/enzo.interiors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-[#1A1A1C] border border-[#2A2A28] flex items-center justify-center text-[#8A9E8C] hover:text-[#F2F0EB] hover:border-[#8A9E8C] transition-all"
                >
                  <Instagram size={18} />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full bg-[#1A1A1C] border border-[#2A2A28] flex items-center justify-center text-[#8A9E8C] hover:text-[#F2F0EB] hover:border-[#8A9E8C] transition-all"
                >
                  <Facebook size={18} />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full bg-[#1A1A1C] border border-[#2A2A28] flex items-center justify-center text-[#8A9E8C] hover:text-[#F2F0EB] hover:border-[#8A9E8C] transition-all"
                >
                  <MessageCircle size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-t border-[#2A2A28] my-8" />

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-between items-center text-[13px] space-y-4 md:space-y-0">
          <p className="text-[#6B6B65]">
            &copy; {new Date().getFullYear()} Enzo Interiors. All rights
            reserved.
          </p>
          <div className="flex gap-6 text-[#6B6B65] text-[12px]">
            <a href="#" className="hover:text-[#8A9E8C] transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-[#8A9E8C] transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>

      {/* Text hover effect */}
      <div className="hidden lg:flex h-[22rem] -mt-44 -mb-28 relative z-50">
        <TextHoverEffect text="ENZO" />
      </div>
    </footer>
  );
}
