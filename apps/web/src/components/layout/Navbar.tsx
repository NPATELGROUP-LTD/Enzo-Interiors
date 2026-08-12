"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "Services", path: "/services" },
  { label: "Portfolio", path: "/portfolio" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
];

// Animated Menu Toggle (hamburger -> X) inspired by 21st.dev
function MenuToggleIcon({
  open,
  className = "",
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <motion.span
        className="absolute left-0 right-0 h-[2px] rounded-full bg-current"
        style={{ top: "25%", transformOrigin: "center" }}
        animate={
          open
            ? { top: "50%", rotate: 45, translateY: "-50%" }
            : { top: "25%", rotate: 0, translateY: "0%" }
        }
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      />
      <motion.span
        className="absolute left-0 right-0 h-[2px] rounded-full bg-current"
        style={{ top: "50%", translateY: "-50%" }}
        animate={{ opacity: open ? 0 : 1, scaleX: open ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      />
      <motion.span
        className="absolute left-0 right-0 h-[2px] rounded-full bg-current"
        style={{ bottom: "25%", transformOrigin: "center" }}
        animate={
          open
            ? { bottom: "50%", rotate: -45, translateY: "50%" }
            : { bottom: "25%", rotate: 0, translateY: "0%" }
        }
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Reset the mobile menu when navigating, per React's "adjusting state on prop
  // change" pattern (https://react.dev/learn/you-might-not-need-an-effect) —
  // this runs during render instead of a post-commit effect, avoiding the extra
  // render pass that setState-in-effect would otherwise trigger.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    const onScroll = () => {
      const onHome = pathname === "/";
      // On home page stay transparent for all 4 hero slides (~4 × viewport height)
      setScrolled(
        onHome ? window.scrollY > window.innerHeight * 4 : window.scrollY > 50,
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // evaluate immediately on mount / route change
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const isHeroPage = pathname === "/";

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled || !isHeroPage
            ? "bg-[#F2F0EB]/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.06)]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <span
              className={`font-[Cormorant_Garamond] italic transition-colors duration-500 ${
                scrolled || !isHeroPage ? "text-[#1C4A3A]" : "text-[#F2F0EB]"
              }`}
              style={{ fontSize: "1.75rem", fontWeight: 600 }}
            >
              Enzo{" "}
              <span
                style={{
                  fontWeight: 300,
                  fontStyle: "normal",
                  fontSize: "0.9rem",
                  letterSpacing: "0.15em",
                }}
              >
                INTERIORS
              </span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`relative text-[14px] tracking-wide transition-colors duration-300 ${
                  scrolled || !isHeroPage
                    ? "hover:text-[#1C4A3A]"
                    : "hover:text-[#F2F0EB]"
                } ${
                  scrolled || !isHeroPage ? "text-[#2C2C2C]" : "text-[#F2F0EB]"
                } ${
                  pathname === link.path
                    ? scrolled || !isHeroPage
                      ? "!text-[#1C4A3A]"
                      : "!text-[#F2F0EB]"
                    : ""
                }`}
              >
                {link.label}
                {pathname === link.path && (
                  <motion.div
                    layoutId="nav-underline"
                    className={`absolute -bottom-1 left-0 right-0 h-[1.5px] ${
                      scrolled || !isHeroPage
                        ? "bg-[#1C4A3A]"
                        : "bg-[#F2F0EB]/60"
                    }`}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* Desktop CTA + Portal Link */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/portal"
              className={`text-[13px] tracking-wide transition-colors duration-300 ${
                scrolled || !isHeroPage
                  ? "text-[#8A9E8C] hover:text-[#1C4A3A]"
                  : "text-[#F2F0EB]/60 hover:text-[#F2F0EB]"
              }`}
            >
              Client Portal
            </Link>
            <Link
              href="/booking"
              className={`inline-flex items-center px-6 py-2.5 rounded-full text-[13px] tracking-wide transition-all duration-300 ${
                scrolled || !isHeroPage
                  ? "bg-[#1C4A3A] text-[#F2F0EB] hover:bg-[#3D6347]"
                  : "border border-[#F2F0EB]/40 text-[#F2F0EB] hover:bg-[#F2F0EB]/10"
              }`}
            >
              Book a Consultation
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`md:hidden relative w-10 h-10 flex items-center justify-center transition-colors ${
              scrolled || !isHeroPage ? "text-[#1C4A3A]" : "text-[#F2F0EB]"
            }`}
          >
            <MenuToggleIcon open={mobileOpen} className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Full-screen Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-[#F2F0EB] flex flex-col items-center justify-center gap-6"
          >
            {navLinks.map((link, i) => (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <Link
                  href={link.path}
                  className={`font-[Cormorant_Garamond] text-[#1C4A3A] hover:text-[#3D6347] transition-colors ${
                    pathname === link.path
                      ? "underline underline-offset-8 decoration-[#8A9E8C]"
                      : ""
                  }`}
                  style={{ fontSize: "2.5rem" }}
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="flex flex-col items-center gap-3 mt-6"
            >
              <Link
                href="/portal"
                className="text-[#8A9E8C] text-[15px] hover:text-[#1C4A3A] transition-colors"
              >
                Client Portal
              </Link>
              <Link
                href="/booking"
                className="px-8 py-3 rounded-full bg-[#1C4A3A] text-[#F2F0EB] text-[15px] tracking-wide"
              >
                Book a Consultation
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
