import { useState } from "react";
import { Link } from "react-router";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ScrollReveal } from "../shared/ScrollReveal";
import { SectionLabel } from "../shared/SectionLabel";
import { ImageWithFallback } from "../figma/ImageWithFallback";

const KITCHEN_IMG = "https://images.unsplash.com/photo-1771627278637-10eb2e9857b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmaXR0ZWQlMjBraXRjaGVuJTIwZGFyayUyMGRyYW1hdGljJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzcyMzk4MjMwfDA&ixlib=rb-4.1.0&q=80&w=1080";
const BEDROOM_IMG = "https://images.unsplash.com/photo-1709544345907-ceea96cb69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXNwb2tlJTIwZml0dGVkJTIwYmVkcm9vbSUyMHdhcm0lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzIzOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080";
const MEDIA_IMG = "https://images.unsplash.com/photo-1764344814733-930223ac186c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRlcnRhaW5tZW50JTIwY2VudGVyJTIwbWVkaWElMjB3YWxsJTIwbW9kZXJufGVufDF8fHx8MTc3MjM5ODIzN3ww&ixlib=rb-4.1.0&q=80&w=1080";
const WARDROBE_IMG = "https://images.unsplash.com/photo-1722942432154-067a239bc58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXR0ZWQlMjB3YXJkcm9iZSUyMHdhbGstaW4lMjBjbG9zZXQlMjBsdXh1cnl8ZW58MXx8fHwxNzcyMzk4MjMyfDA&ixlib=rb-4.1.0&q=80&w=1080";
const SAGE_KITCHEN = "https://images.unsplash.com/photo-1721522282337-6b6d3e366463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBraXRjaGVuJTIwc2FnZSUyMGdyZWVuJTIwZml0dGVkfGVufDF8fHx8MTc3MjM5ODIzMnww&ixlib=rb-4.1.0&q=80&w=1080";
const LIVING_IMG = "https://images.unsplash.com/photo-1763647972062-5e9cd48fb282?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBsaXZpbmclMjByb29tJTIwaW50ZXJpb3IlMjB3YXJtfGVufDF8fHx8MTc3MjM5ODIzOHww&ixlib=rb-4.1.0&q=80&w=1080";
const MOODY_KITCHEN = "https://images.unsplash.com/photo-1765766601532-90e9b96320c8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBpbnRlcmlvciUyMGRlc2lnbiUyMGRhcmslMjBtb29keSUyMGtpdGNoZW58ZW58MXx8fHwxNzcyMzk4MjMzfDA&ixlib=rb-4.1.0&q=80&w=1080";
const WARM_BEDROOM = "https://images.unsplash.com/photo-1765434669956-afcd50058d69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBiZWRyb29tJTIwaW50ZXJpb3IlMjB3YXJtJTIwdG9uZXN8ZW58MXx8fHwxNzcyMzk4MjMzfDA&ixlib=rb-4.1.0&q=80&w=1080";
const BATHROOM_IMG = "https://images.unsplash.com/photo-1572742482459-e04d6cfdd6f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBiYXRocm9vbSUyMGludGVyaW9yJTIwbWFyYmxlfGVufDF8fHx8MTc3MjM3MTAwOHww&ixlib=rb-4.1.0&q=80&w=1080";

const projects = [
  { id: 1, title: "Modern Sage Kitchen", category: "Kitchens", image: SAGE_KITCHEN, location: "Oadby", client: "Sarah & Mark Thompson", duration: "5 weeks", year: "2025", desc: "A stunning sage green kitchen featuring handleless cabinetry, quartz worktops, and integrated Bosch appliances. The design maximises the open-plan layout with a large island unit perfect for entertaining.", materials: ["Sage painted MDF", "Quartz worktops", "Brass hardware", "Integrated LED lighting"] },
  { id: 2, title: "Master Bedroom Suite", category: "Bedrooms", image: BEDROOM_IMG, location: "Stoneygate", client: "James & Lisa Mitchell", duration: "4 weeks", year: "2025", desc: "A luxurious master bedroom with floor-to-ceiling fitted wardrobes, custom headboard with integrated reading lights, and matching bedside units. The warm oak finish creates an inviting sanctuary.", materials: ["Natural oak veneer", "Cashmere lacquer", "Brass pulls", "Fabric headboard"] },
  { id: 3, title: "Entertainment Media Wall", category: "Media Walls", image: MEDIA_IMG, location: "Clarendon Park", client: "Emma & Tom Richardson", duration: "3 weeks", year: "2025", desc: "A striking media wall featuring a 75-inch recessed TV, electric fireplace, ambient LED strips, and hidden cable management. The matt anthracite finish gives a contemporary, cinema-like feel.", materials: ["Matt anthracite panels", "LED strip lighting", "Electric fireplace insert", "Acoustic fabric"] },
  { id: 4, title: "Walk-in Wardrobe", category: "Wardrobes", image: WARDROBE_IMG, location: "Knighton", client: "David & Sophie Chen", duration: "3 weeks", year: "2026", desc: "A beautifully organised walk-in wardrobe with dedicated zones for each type of clothing. Features include pull-down hanging rails, illuminated shoe storage, and a jewellery island.", materials: ["White gloss laminate", "Mirror panels", "Chrome fittings", "Touch-LED lighting"] },
  { id: 5, title: "Dark Luxury Kitchen", category: "Kitchens", image: MOODY_KITCHEN, location: "Groby", client: "Michael Ford", duration: "6 weeks", year: "2025", desc: "A dramatic dark kitchen with charcoal cabinetry, Dekton worktops, and gold-accented hardware. The moody palette is balanced with under-cabinet lighting and a skylight.", materials: ["Charcoal painted oak", "Dekton worktops", "Brushed gold hardware", "Smoked glass splashback"] },
  { id: 6, title: "Contemporary Bedroom", category: "Bedrooms", image: WARM_BEDROOM, location: "Wigston", client: "Rachel Adams", duration: "3 weeks", year: "2025", desc: "A clean, contemporary bedroom with built-in wardrobes that disappear into the wall. The warm white palette with walnut accents creates a calming, minimalist retreat.", materials: ["Matt white lacquer", "American walnut accents", "Soft-close mechanisms", "Concealed handles"] },
  { id: 7, title: "Classic Fitted Kitchen", category: "Kitchens", image: KITCHEN_IMG, location: "Birstall", client: "Tom Bailey", duration: "5 weeks", year: "2024", desc: "A timeless Shaker-style kitchen in a rich deep green. Featuring Belfast sink, marble worktops, and open shelving for a classic yet functional design.", materials: ["Painted Shaker doors", "Carrara marble worktops", "Antique brass cup handles", "Open timber shelving"] },
  { id: 8, title: "Living Room Redesign", category: "Media Walls", image: LIVING_IMG, location: "Evington", client: "Priya & Raj Patel", duration: "2 weeks", year: "2025", desc: "A complete living room transformation featuring a full-width media wall with integrated bio-ethanol fireplace, floating shelves, and hidden storage for games consoles.", materials: ["Porcelain stone panels", "Bio-ethanol fireplace", "Floating oak shelves", "Concealed storage"] },
  { id: 9, title: "Luxury Ensuite", category: "Bedrooms", image: BATHROOM_IMG, location: "Market Harborough", client: "Laura Harrison", duration: "4 weeks", year: "2025", desc: "A hotel-inspired ensuite bedroom and bathroom combination featuring bespoke vanity units, walk-in shower enclosure, and matching bedroom furniture in a calming stone palette.", materials: ["Polished marble tiles", "Bespoke vanity unit", "Chrome fittings", "Stone-effect porcelain"] },
];

const filters = ["All", "Kitchens", "Bedrooms", "Media Walls", "Wardrobes"];

export function PortfolioPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedProject, setSelectedProject] = useState<typeof projects[0] | null>(null);

  const filtered = activeFilter === "All" ? projects : projects.filter((p) => p.category === activeFilter);

  return (
    <div>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-[#F2F0EB]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <p className="text-[#8A9E8C] text-[12px] uppercase tracking-[0.2em] mb-4">
            <Link to="/" className="hover:text-[#1C4A3A] transition-colors">Home</Link> / Portfolio
          </p>
          <h1 className="text-[#1C4A3A]" style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}>Our Portfolio</h1>
        </div>
      </section>

      {/* Filter + Grid */}
      <section className="py-12 bg-[#F2F0EB]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex flex-wrap gap-3 mb-12">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-5 py-2 rounded-full text-[13px] tracking-wide transition-all duration-300 ${
                  activeFilter === f
                    ? "bg-[#1C4A3A] text-[#F2F0EB]"
                    : "border border-[#8A9E8C] text-[#8A9E8C] hover:border-[#1C4A3A] hover:text-[#1C4A3A]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
            {filtered.map((project, i) => (
              <ScrollReveal key={project.id} delay={i * 0.05}>
                <div
                  className="mb-4 break-inside-avoid group relative rounded-2xl overflow-hidden cursor-pointer"
                  onClick={() => setSelectedProject(project)}
                >
                  <ImageWithFallback
                    src={project.image}
                    alt={project.title}
                    className="w-full object-cover rounded-2xl"
                    style={{ height: i % 3 === 0 ? "380px" : i % 3 === 1 ? "300px" : "340px" }}
                  />
                  <div className="absolute inset-0 bg-[#1C4A3A]/0 group-hover:bg-[#1C4A3A]/70 transition-all duration-500 flex flex-col items-start justify-end p-6">
                    <div className="opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                      <span className="text-[#8A9E8C] text-[11px] uppercase tracking-[0.2em]">{project.category}</span>
                      <h3 className="text-[#F2F0EB] mt-1" style={{ fontSize: "1.3rem" }}>{project.title}</h3>
                      <p className="text-[#F2F0EB]/60 text-[13px] mt-1">{project.location}</p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Project Detail Modal - Image left, content right */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={() => setSelectedProject(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#FAFAF7] rounded-3xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image - left side, fully visible (contain, not cover) */}
              <div className="md:w-1/2 bg-[#1E1E1C] flex items-center justify-center p-4 min-h-[300px] md:min-h-0 relative flex-shrink-0">
                <ImageWithFallback
                  src={selectedProject.image}
                  alt={selectedProject.title}
                  className="w-full h-full rounded-xl"
                  style={{ objectFit: "contain", maxHeight: "80vh" }}
                />
                {/* Close button on mobile */}
                <button
                  onClick={() => setSelectedProject(null)}
                  className="absolute top-4 right-4 md:hidden w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content - right side */}
              <div className="md:w-1/2 p-8 overflow-y-auto relative">
                {/* Close button desktop */}
                <button
                  onClick={() => setSelectedProject(null)}
                  className="absolute top-4 right-4 hidden md:flex w-10 h-10 rounded-full bg-[#F2F0EB] text-[#6B6B65] items-center justify-center hover:bg-[#EAE7E0] transition-colors"
                >
                  <X size={18} />
                </button>

                <span className="text-[#8A9E8C] text-[11px] uppercase tracking-[0.2em]">{selectedProject.category}</span>
                <h2 className="text-[#1C4A3A] mt-2" style={{ fontSize: "1.8rem" }}>{selectedProject.title}</h2>

                {/* Project meta */}
                <div className="mt-6 grid grid-cols-2 gap-4 text-[14px]">
                  <div><span className="text-[#8A9E8C] text-[12px]">Location</span><p className="text-[#2C2C2C] mt-0.5">{selectedProject.location}</p></div>
                  <div><span className="text-[#8A9E8C] text-[12px]">Client</span><p className="text-[#2C2C2C] mt-0.5">{selectedProject.client}</p></div>
                  <div><span className="text-[#8A9E8C] text-[12px]">Duration</span><p className="text-[#2C2C2C] mt-0.5">{selectedProject.duration}</p></div>
                  <div><span className="text-[#8A9E8C] text-[12px]">Completed</span><p className="text-[#2C2C2C] mt-0.5">{selectedProject.year}</p></div>
                </div>

                {/* Description */}
                <div className="mt-6">
                  <h4 className="text-[#1C4A3A] text-[14px] mb-2" style={{ fontWeight: 500 }}>About This Project</h4>
                  <p className="text-[#6B6B65] text-[14px] leading-relaxed">{selectedProject.desc}</p>
                </div>

                {/* Materials */}
                <div className="mt-6">
                  <h4 className="text-[#1C4A3A] text-[14px] mb-3" style={{ fontWeight: 500 }}>Materials & Finishes</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.materials.map((m) => (
                      <span key={m} className="px-3 py-1.5 rounded-full bg-[#1C4A3A]/8 text-[#1C4A3A] text-[12px]">{m}</span>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/booking"
                    className="px-6 py-3 rounded-full bg-[#1C4A3A] text-[#F2F0EB] text-[13px] text-center hover:bg-[#3D6347] transition-all duration-300"
                    onClick={() => setSelectedProject(null)}
                  >
                    Start a Similar Project
                  </Link>
                  <Link
                    to="/contact"
                    className="px-6 py-3 rounded-full border border-[#C4B8A8] text-[#1C4A3A] text-[13px] text-center hover:bg-[#1C4A3A] hover:text-[#F2F0EB] transition-all duration-300"
                    onClick={() => setSelectedProject(null)}
                  >
                    Get In Touch
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
