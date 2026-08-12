"use client";

// Ported from Boilerplate:src/app/components/pages/PortfolioPage.tsx's
// filter state, masonry grid, and project detail modal. The boilerplate
// used CSS multi-column masonry (`columns-* + break-inside-avoid`), not a
// masonry library — same approach kept here, so no new dependency was
// needed. Filter + selected-project state is Client-only; the hero above
// this component (page.tsx) stays a Server Component.
import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import type { PortfolioItem } from "@/lib/content";

const FILTERS = ["All", "Kitchens", "Bedrooms", "Media Walls", "Wardrobes"];

export function PortfolioGallery({ items }: { items: PortfolioItem[] }) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedProject, setSelectedProject] = useState<PortfolioItem | null>(
    null,
  );

  const filtered =
    activeFilter === "All"
      ? items
      : items.filter((p) => p.category === activeFilter);

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-12">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-5 py-2 rounded-full text-[13px] tracking-wide transition-all duration-300 ${
              activeFilter === f
                ? "bg-primary text-primary-foreground"
                : "border border-enzo-sage text-enzo-sage hover:border-primary hover:text-primary"
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
                style={{
                  height:
                    i % 3 === 0 ? "380px" : i % 3 === 1 ? "300px" : "340px",
                }}
              />
              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/70 transition-all duration-500 flex flex-col items-start justify-end p-6">
                <div className="opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                  <span className="text-enzo-sage text-[11px] uppercase tracking-[0.2em]">
                    {project.category}
                  </span>
                  <h3 className="text-enzo-cream mt-1" style={{ fontSize: "1.3rem" }}>
                    {project.title}
                  </h3>
                  <p className="text-enzo-cream/60 text-[13px] mt-1">
                    {project.location}
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Project Detail Modal — image left, content right */}
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
              className="bg-card rounded-3xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image */}
              <div className="md:w-1/2 bg-enzo-dark flex items-center justify-center p-4 min-h-[300px] md:min-h-0 relative flex-shrink-0">
                <ImageWithFallback
                  src={selectedProject.image}
                  alt={selectedProject.title}
                  className="w-full h-full rounded-xl"
                  style={{ objectFit: "contain", maxHeight: "80vh" }}
                />
                <button
                  onClick={() => setSelectedProject(null)}
                  className="absolute top-4 right-4 md:hidden w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="md:w-1/2 p-8 overflow-y-auto relative">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="absolute top-4 right-4 hidden md:flex w-10 h-10 rounded-full bg-background text-muted-foreground items-center justify-center hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>

                <span className="text-enzo-sage text-[11px] uppercase tracking-[0.2em]">
                  {selectedProject.category}
                </span>
                <h2 className="text-primary mt-2" style={{ fontSize: "1.8rem" }}>
                  {selectedProject.title}
                </h2>

                <div className="mt-6 grid grid-cols-2 gap-4 text-[14px]">
                  <div>
                    <span className="text-enzo-sage text-[12px]">Location</span>
                    <p className="text-foreground mt-0.5">
                      {selectedProject.location}
                    </p>
                  </div>
                  <div>
                    <span className="text-enzo-sage text-[12px]">Client</span>
                    <p className="text-foreground mt-0.5">
                      {selectedProject.client}
                    </p>
                  </div>
                  <div>
                    <span className="text-enzo-sage text-[12px]">Duration</span>
                    <p className="text-foreground mt-0.5">
                      {selectedProject.duration}
                    </p>
                  </div>
                  <div>
                    <span className="text-enzo-sage text-[12px]">Completed</span>
                    <p className="text-foreground mt-0.5">
                      {selectedProject.year}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h4
                    className="text-primary text-[14px] mb-2"
                    style={{ fontWeight: 500 }}
                  >
                    About This Project
                  </h4>
                  <p className="text-muted-foreground text-[14px] leading-relaxed">
                    {selectedProject.desc}
                  </p>
                </div>

                <div className="mt-6">
                  <h4
                    className="text-primary text-[14px] mb-3"
                    style={{ fontWeight: 500 }}
                  >
                    Materials &amp; Finishes
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.materials.map((m) => (
                      <span
                        key={m}
                        className="px-3 py-1.5 rounded-full bg-primary/8 text-primary text-[12px]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/booking"
                    className="px-6 py-3 rounded-full bg-primary text-primary-foreground text-[13px] text-center hover:bg-enzo-forest-light transition-all duration-300"
                    onClick={() => setSelectedProject(null)}
                  >
                    Start a Similar Project
                  </Link>
                  <Link
                    href="/contact"
                    className="px-6 py-3 rounded-full border border-border text-primary text-[13px] text-center hover:bg-primary hover:text-primary-foreground transition-all duration-300"
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
    </>
  );
}
