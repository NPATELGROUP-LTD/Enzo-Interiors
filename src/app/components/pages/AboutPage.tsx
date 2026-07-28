import { Link } from "react-router";
import { Heart, Eye, Gem } from "lucide-react";
import { ScrollReveal } from "../shared/ScrollReveal";
import { SectionLabel } from "../shared/SectionLabel";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { useEffect, useRef } from "react";

const PORTRAIT_IMG =
  "https://images.unsplash.com/photo-1768471125958-78556538fadc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnRlcmlvciUyMGRlc2lnbmVyJTIwcG9ydHJhaXQlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzcyMjk3MTMzfDA&ixlib=rb-4.1.0&q=80&w=1080";
const CONSULTATION_IMG =
  "https://images.unsplash.com/photo-1594125674965-70d796b6693f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnRlcmlvciUyMGRlc2lnbiUyMGNvbnN1bHRhdGlvbiUyMG1lZXRpbmd8ZW58MXx8fHwxNzcyMzk4MjM0fDA&ixlib=rb-4.1.0&q=80&w=1080";

const milestones = [
  {
    year: "June 2025",
    title: "Enzo Interiors Founded",
    desc: "Started with a passion for bespoke interior design in Leicester.",
  },
  {
    year: "August 2025",
    title: "First Project Completed",
    desc: "Delivered our first bespoke fitted kitchen in Oadby.",
  },
  {
    year: "November 2025",
    title: "Team Expansion",
    desc: "Welcomed our first dedicated installation team.",
  },
  {
    year: "March 2026",
    title: "50+ Projects Completed",
    desc: "Reached a milestone of 50 completed bespoke projects across Leicestershire.",
  },
];

const values = [
  {
    Icon: Gem,
    title: "Craftsmanship",
    desc: "Every piece is handcrafted with precision and care, using only the finest materials.",
  },
  {
    Icon: Heart,
    title: "Honesty",
    desc: "Transparent pricing, honest advice, and no hidden costs — ever.",
  },
  {
    Icon: Eye,
    title: "Attention to Detail",
    desc: "From millimetre-perfect measurements to flawless finishes, we obsess over the details.",
  },
];

export function AboutPage() {
  return (
    <div>
      {/* Hero Split */}
      <section className="pt-20 bg-[#F2F0EB]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-20">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <ScrollReveal className="md:w-1/2">
              <div className="rounded-2xl overflow-hidden">
                <ImageWithFallback
                  src={PORTRAIT_IMG}
                  alt="Enzo Interiors team"
                  className="w-full h-[500px] object-cover"
                />
              </div>
            </ScrollReveal>
            <ScrollReveal className="md:w-1/2" delay={0.15}>
              <SectionLabel text="About Us" className="!justify-start" />
              <h1
                className="text-[#1C4A3A] mt-4"
                style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
              >
                Our Story
              </h1>
              <p className="text-[#6B6B65] mt-6 text-[15px] leading-[1.8]">
                Enzo Interiors was born from a simple belief: that everyone
                deserves a home that's been designed around them, not the other
                way around.
              </p>
              <p className="text-[#6B6B65] mt-4 text-[15px] leading-[1.8]">
                Founded by Oyz Khan in Leicester, we specialise in bespoke
                fitted furniture — from stunning kitchens and elegant bedrooms
                to statement media walls and space-maximising wardrobes. Every
                single piece we create is manufactured to the client's exact
                specifications.
              </p>
              <p className="text-[#6B6B65] mt-4 text-[15px] leading-[1.8]">
                We're not a high-volume factory. We're craftspeople who take
                pride in the work we do, the relationships we build, and the
                spaces we transform.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <ScrollReveal>
            <SectionLabel text="Our Journey" />
            <h2
              className="text-center text-[#1C4A3A] mt-4"
              style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
            >
              Milestones
            </h2>
          </ScrollReveal>

          <div className="mt-16 relative">
            {/* Vertical line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#8A9E8C]/30 hidden md:block" />
            {milestones.map((m, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div
                  className={`flex flex-col md:flex-row items-center gap-8 mb-12 ${i % 2 === 0 ? "" : "md:flex-row-reverse"}`}
                >
                  <div
                    className={`md:w-1/2 ${i % 2 === 0 ? "md:text-right md:pr-12" : "md:text-left md:pl-12"}`}
                  >
                    <span className="text-[#8A9E8C] text-[12px] uppercase tracking-[0.2em]">
                      {m.year}
                    </span>
                    <h4
                      className="text-[#1C4A3A] mt-1"
                      style={{ fontSize: "1.2rem" }}
                    >
                      {m.title}
                    </h4>
                    <p className="text-[#6B6B65] text-[14px] mt-1">{m.desc}</p>
                  </div>
                  <div className="hidden md:flex w-4 h-4 rounded-full bg-[#1C4A3A] border-4 border-[#FAFAF7] z-10" />
                  <div className="md:w-1/2" />
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-[#F2F0EB]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <ScrollReveal>
            <SectionLabel text="Our Values" />
            <h2
              className="text-center text-[#1C4A3A] mt-4"
              style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
            >
              What We Stand For
            </h2>
          </ScrollReveal>
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((v, i) => (
              <ScrollReveal key={v.title} delay={i * 0.1}>
                <div className="bg-[#FAFAF7] rounded-2xl p-8 text-center shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-14 h-14 rounded-full bg-[#1C4A3A]/10 flex items-center justify-center mx-auto">
                    <v.Icon size={24} className="text-[#1C4A3A]" />
                  </div>
                  <h3
                    className="text-[#1C4A3A] mt-6"
                    style={{ fontSize: "1.3rem" }}
                  >
                    {v.title}
                  </h3>
                  <p className="text-[#6B6B65] text-[14px] mt-3 leading-relaxed">
                    {v.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Particle Text Section */}
      <ParticleTextSection />

      {/* Team */}
      <section className="py-24 bg-[#F2F0EB]">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <ScrollReveal>
            <SectionLabel text="Our Team" />
            <h2
              className="text-center text-[#1C4A3A] mt-4"
              style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
            >
              Meet the Founder
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="mt-12 bg-[#FAFAF7] rounded-2xl p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
              <div className="w-32 h-32 rounded-full overflow-hidden flex-shrink-0 bg-[#1C4A3A]/10">
                <ImageWithFallback
                  src={CONSULTATION_IMG}
                  alt="Oyz Khan"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-[#1C4A3A]" style={{ fontSize: "1.4rem" }}>
                  Oyz Khan
                </h3>
                <p className="text-[#8A9E8C] text-[13px] mt-1">
                  Founder & Lead Designer
                </p>
                <p className="text-[#6B6B65] text-[14px] mt-4 leading-relaxed">
                  With a deep passion for interior design and craftsmanship, Oyz
                  founded Enzo Interiors to bring truly bespoke, high-quality
                  fitted furniture to homes across Leicestershire. Every project
                  is personally overseen to ensure it meets our exacting
                  standards.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

function ParticleTextSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const particles: {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      vx: number;
      vy: number;
    }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
      initParticles();
    };

    const initParticles = () => {
      particles.length = 0;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.fillStyle = "#F2F0EB";
      ctx.font = `bold ${Math.min(w / 8, 80)}px 'Cormorant Garamond', serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ENZO INTERIORS", w / 2, h / 2);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const step = 4;

      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const i = (y * canvas.width + x) * 4;
          if (imageData.data[i + 3] > 128) {
            particles.push({
              x: x / 2,
              y: y / 2,
              baseX: x / 2,
              baseY: y / 2,
              size: 1.5,
              vx: 0,
              vy: 0,
            });
          }
        }
      }
    };

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      ctx.fillStyle = "#8A9E8C";

      for (const p of particles) {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = Math.max(0, 80 - dist) / 80;

        if (force > 0) {
          p.vx -= (dx / dist) * force * 3;
          p.vy -= (dy / dist) * force * 3;
        }

        p.vx += (p.baseX - p.x) * 0.05;
        p.vy += (p.baseY - p.y) * 0.05;
        p.vx *= 0.85;
        p.vy *= 0.85;
        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };

    resize();
    animate();

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    };
    window.addEventListener("resize", debouncedResize);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <section className="bg-[#1C4A3A] py-12">
      <canvas
        ref={canvasRef}
        className="w-full h-[250px] md:h-[350px] cursor-crosshair"
      />
    </section>
  );
}
