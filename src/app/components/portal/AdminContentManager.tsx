import { useState } from "react";
import { useOutletContext } from "react-router";
import { motion } from "motion/react";
import {
  Globe,
  FileText,
  Image,
  Type,
  Save,
  Eye,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

const pages = [
  {
    id: "home",
    label: "Home Page",
    sections: [
      "Hero",
      "Services",
      "Process",
      "Why Enzo",
      "Portfolio Preview",
      "Testimonials",
      "CTA",
      "Instagram",
    ],
  },
  {
    id: "services",
    label: "Services",
    sections: [
      "Hero",
      "Kitchens",
      "Bedrooms",
      "Media Walls",
      "Wardrobes",
      "FAQs",
    ],
  },
  { id: "portfolio", label: "Portfolio", sections: ["Hero", "Projects Grid"] },
  {
    id: "about",
    label: "About",
    sections: ["Hero", "Story", "Team", "Values"],
  },
  {
    id: "contact",
    label: "Contact",
    sections: ["Hero", "Form", "Details", "WhatsApp CTA"],
  },
  {
    id: "booking",
    label: "Booking",
    sections: ["Calendar", "Form", "Confirmation"],
  },
];

const homeContent = {
  hero: {
    tagline: "Leicestershire's Bespoke Interior Specialists",
    heading: "Crafting Bespoke",
    rotatingWords: "Kitchens, Bedrooms, Wardrobes, Media Walls, Spaces",
    subtitle:
      "Every space we create is entirely unique. Bespoke fitted furniture, designed and built in Leicester.",
    ctaPrimary: "Book a Free Consultation",
    ctaSecondary: "View Our Work",
  },
  services: {
    heading: "Everything. Beautifully Made.",
    subtitle:
      "From initial concept to final installation, we handle every detail.",
  },
  process: {
    heading: "How It Works",
    steps: [
      "Consultation - We visit your home, discuss your vision, and take measurements.",
      "Design & Approval - We create 3D designs for your review and refine until perfect.",
      "Installation - Our expert team installs everything to the highest standard.",
    ],
  },
  whyEnzo: { heading: "A Different Kind of Interior Company.", stats: "100%" },
  testimonials: {
    heading: "What Our Clients Say.",
    subtitle: "See what our customers have to say about us.",
  },
  cta: {
    heading: "Ready to transform your space?",
    subtitle: "Book a free consultation — no pressure, no obligation",
    button: "Book a Slot",
  },
  instagram: { heading: "Follow Our Journey", handle: "@enzo.interiors" },
};

const serviceItems = [
  {
    id: "kitchens",
    title: "Bespoke Kitchens",
    description: "Our kitchens are designed from scratch...",
    features:
      "Custom cabinetry & worktops, Integrated appliance planning, Premium handle & finish selection, 3D design visualisation, Full project management, 5-year workmanship guarantee",
  },
  {
    id: "bedrooms",
    title: "Fitted Bedrooms",
    description: "Transform your bedroom into a serene retreat...",
    features:
      "Built-in wardrobes & storage, Custom headboard designs, Bedside & dressing table units",
  },
  {
    id: "media-walls",
    title: "Media Walls",
    description: "Create a stunning focal point...",
    features:
      "Integrated TV & sound solutions, Hidden cable management, Ambient LED lighting",
  },
  {
    id: "wardrobes",
    title: "Fitted Wardrobes",
    description: "Maximise every inch of your bedroom...",
    features:
      "Sliding or hinged door options, Internal drawer systems, Shoe racks & accessory storage",
  },
];

const testimonialsList = [
  {
    id: 1,
    name: "Sarah Thompson",
    location: "Oadby, Leicester",
    text: "Enzo Interiors transformed our kitchen beyond our wildest dreams.",
    visible: true,
  },
  {
    id: 2,
    name: "James Mitchell",
    location: "Stoneygate",
    text: "Our fitted bedroom is stunning.",
    visible: true,
  },
  {
    id: 3,
    name: "Emma Richardson",
    location: "Clarendon Park",
    text: "The media wall they designed is the centrepiece of our home.",
    visible: true,
  },
  {
    id: 4,
    name: "David Chen",
    location: "Knighton",
    text: "From consultation to installation, the process was seamless.",
    visible: true,
  },
  {
    id: 5,
    name: "Rachel Adams",
    location: "Wigston",
    text: "We chose Enzo for our entire home renovation.",
    visible: false,
  },
];

export function AdminContentManager() {
  usePageTitle("Content Manager - Admin Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [activePage, setActivePage] = useState("home");
  const [activeSection, setActiveSection] = useState("hero");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [content, setContent] = useState(homeContent);
  const [services, setServices] = useState(serviceItems);
  const [testimonials, setTestimonials] = useState(testimonialsList);

  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const acc = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const inp = darkMode
    ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]"
    : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]";
  const accBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";

  const currentPage = pages.find((p) => p.id === activePage)!;

  const handleSave = () => {
    toast.success(
      "Content saved successfully! Changes will be reflected on the website.",
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={t1}
          style={{ fontSize: "1.8rem" }}
        >
          Website Content
        </motion.h1>
        <div className="flex gap-2">
          <a
            href="/"
            target="_blank"
            className={`px-4 py-2 rounded-full text-[12px] border flex items-center gap-1.5 ${darkMode ? "border-[#2A2A28] text-[#8A8A82] hover:text-[#F0EEE9]" : "border-[#C4B8A8] text-[#6B6B65] hover:text-[#1C4A3A]"} transition-colors`}
          >
            <Eye size={14} /> Preview Site
          </a>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-full text-[12px] text-white flex items-center gap-1.5 ${accBg}`}
          >
            <Save size={14} /> Publish Changes
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Page Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <div className={`${c} border rounded-2xl p-3`}>
            <span
              className={`text-[10px] uppercase tracking-[0.2em] ${t2} px-3 py-2 block`}
            >
              Pages
            </span>
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => {
                  setActivePage(page.id);
                  setActiveSection(
                    page.sections[0].toLowerCase().replace(/ /g, "-"),
                  );
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] transition-colors ${activePage === page.id ? (darkMode ? "bg-[#4A8C5C]/10 text-[#4A8C5C]" : "bg-[#1C4A3A]/10 text-[#1C4A3A]") : `${t2} ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}`}
              >
                <Globe size={14} />
                {page.label}
                <ChevronRight size={12} className="ml-auto" />
              </button>
            ))}
          </div>

          {/* Section Navigation */}
          <div className={`${c} border rounded-2xl p-3 mt-4`}>
            <span
              className={`text-[10px] uppercase tracking-[0.2em] ${t2} px-3 py-2 block`}
            >
              Sections
            </span>
            {currentPage.sections.map((section) => {
              const sectionId = section.toLowerCase().replace(/ /g, "-");
              return (
                <button
                  key={sectionId}
                  onClick={() => setActiveSection(sectionId)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-colors ${activeSection === sectionId ? (darkMode ? "bg-[#2A2A28] text-[#F0EEE9]" : "bg-[#EAE7E0] text-[#1C4A3A]") : `${t2} ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}`}
                >
                  <Type size={12} />
                  {section}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Editor */}
        <div className="flex-1">
          <div className={`${c} border rounded-2xl p-6`}>
            {/* Home Page Editor */}
            {activePage === "home" && activeSection === "hero" && (
              <div className="space-y-5">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Hero Section
                </h3>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Tagline
                  </label>
                  <input
                    defaultValue={content.hero.tagline}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        hero: { ...content.hero, tagline: e.target.value },
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Main Heading
                  </label>
                  <input
                    defaultValue={content.hero.heading}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        hero: { ...content.hero, heading: e.target.value },
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Rotating Words (comma-separated)
                  </label>
                  <input
                    defaultValue={content.hero.rotatingWords}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        hero: {
                          ...content.hero,
                          rotatingWords: e.target.value,
                        },
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Subtitle
                  </label>
                  <textarea
                    rows={2}
                    defaultValue={content.hero.subtitle}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        hero: { ...content.hero, subtitle: e.target.value },
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none resize-none ${inp}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Primary CTA Text
                    </label>
                    <input
                      defaultValue={content.hero.ctaPrimary}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          hero: { ...content.hero, ctaPrimary: e.target.value },
                        })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Secondary CTA Text
                    </label>
                    <input
                      defaultValue={content.hero.ctaSecondary}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          hero: {
                            ...content.hero,
                            ctaSecondary: e.target.value,
                          },
                        })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-2`}>
                    Hero Background Images
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {["Kitchens", "Bedrooms", "Media Walls", "Wardrobes"].map(
                      (label) => (
                        <div
                          key={label}
                          className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer hover:border-solid transition-all ${darkMode ? "border-[#2A2A28] hover:border-[#4A8C5C]" : "border-[#C4B8A8] hover:border-[#1C4A3A]"}`}
                        >
                          <Image size={20} className={`mx-auto mb-1 ${t2}`} />
                          <span className={`text-[10px] ${t2}`}>{label}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Hero
                </button>
              </div>
            )}

            {activePage === "home" && activeSection === "services" && (
              <div className="space-y-5">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Services Section
                </h3>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Section Heading
                  </label>
                  <input
                    defaultValue={content.services.heading}
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Section Subtitle
                  </label>
                  <input
                    defaultValue={content.services.subtitle}
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <button
                  onClick={handleSave}
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Section
                </button>
              </div>
            )}

            {activePage === "home" && activeSection === "testimonials" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                    Testimonials
                  </h3>
                  <button
                    onClick={() =>
                      setTestimonials([
                        ...testimonials,
                        {
                          id: Date.now(),
                          name: "",
                          location: "",
                          text: "",
                          visible: true,
                        },
                      ])
                    }
                    className={`px-3 py-1.5 rounded-full text-[11px] text-white flex items-center gap-1 ${accBg}`}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Section Heading
                  </label>
                  <input
                    defaultValue={content.testimonials.heading}
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                {testimonials.map((t, i) => (
                  <div
                    key={t.id}
                    className={`p-4 rounded-xl border ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/30"}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className={t2} />
                        <span
                          className={`text-[12px] ${t1}`}
                          style={{ fontWeight: 500 }}
                        >
                          Testimonial #{i + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={t.visible}
                            onChange={() => {
                              const upd = [...testimonials];
                              upd[i].visible = !upd[i].visible;
                              setTestimonials(upd);
                            }}
                            className="sr-only peer"
                          />
                          <div
                            className={`w-8 h-4 rounded-full peer peer-checked:${accBg} transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-transform peer-checked:after:translate-x-4 ${darkMode ? "bg-[#2A2A28]" : "bg-[#C4B8A8]"}`}
                          />
                        </label>
                        <button
                          onClick={() =>
                            setTestimonials(
                              testimonials.filter((x) => x.id !== t.id),
                            )
                          }
                          className="text-red-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input
                        placeholder="Name"
                        defaultValue={t.name}
                        className={`px-3 py-2 rounded-lg border text-[12px] focus:outline-none ${inp}`}
                      />
                      <input
                        placeholder="Location"
                        defaultValue={t.location}
                        className={`px-3 py-2 rounded-lg border text-[12px] focus:outline-none ${inp}`}
                      />
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Testimonial text..."
                      defaultValue={t.text}
                      className={`w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none resize-none ${inp}`}
                    />
                  </div>
                ))}
                <button
                  onClick={handleSave}
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Testimonials
                </button>
              </div>
            )}

            {activePage === "services" && (
              <div className="space-y-5">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Services Content
                </h3>
                {services.map((svc, i) => (
                  <div
                    key={svc.id}
                    className={`p-4 rounded-xl border ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/30"}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={14} className={acc} />
                      <span
                        className={`text-[13px] ${t1}`}
                        style={{ fontWeight: 500 }}
                      >
                        {svc.title}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className={`text-[11px] ${t2} block mb-1`}>
                          Title
                        </label>
                        <input
                          defaultValue={svc.title}
                          className={`w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none ${inp}`}
                        />
                      </div>
                      <div>
                        <label className={`text-[11px] ${t2} block mb-1`}>
                          Description
                        </label>
                        <textarea
                          rows={2}
                          defaultValue={svc.description}
                          className={`w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none resize-none ${inp}`}
                        />
                      </div>
                      <div>
                        <label className={`text-[11px] ${t2} block mb-1`}>
                          Features (comma-separated)
                        </label>
                        <textarea
                          rows={2}
                          defaultValue={svc.features}
                          className={`w-full px-3 py-2 rounded-lg border text-[12px] focus:outline-none resize-none ${inp}`}
                        />
                      </div>
                      <div
                        className={`rounded-lg border-2 border-dashed p-3 text-center cursor-pointer ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]"}`}
                      >
                        <Image size={16} className={`mx-auto mb-1 ${t2}`} />
                        <span className={`text-[10px] ${t2}`}>
                          Upload/change image
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSave}
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Services
                </button>
              </div>
            )}

            {/* Default for sections not yet detailed */}
            {activePage === "home" &&
              !["hero", "services", "testimonials"].includes(activeSection) && (
                <div className="space-y-5">
                  <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                    {currentPage.sections.find(
                      (s) =>
                        s.toLowerCase().replace(/ /g, "-") === activeSection,
                    ) || activeSection}{" "}
                    Section
                  </h3>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Section Heading
                    </label>
                    <input
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                      placeholder="Enter heading..."
                    />
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Section Content
                    </label>
                    <textarea
                      rows={4}
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none resize-none ${inp}`}
                      placeholder="Enter content..."
                    />
                  </div>
                  <div
                    className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]"}`}
                  >
                    <Image size={24} className={`mx-auto mb-2 ${t2}`} />
                    <span className={`text-[12px] ${t2}`}>
                      Upload section image
                    </span>
                  </div>
                  <button
                    onClick={handleSave}
                    className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                  >
                    Save Section
                  </button>
                </div>
              )}

            {!["home", "services"].includes(activePage) && (
              <div className="space-y-5">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  {currentPage.label} —{" "}
                  {currentPage.sections.find(
                    (s) => s.toLowerCase().replace(/ /g, "-") === activeSection,
                  ) || activeSection}
                </h3>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Heading
                  </label>
                  <input
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    placeholder="Enter heading..."
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Content
                  </label>
                  <textarea
                    rows={4}
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none resize-none ${inp}`}
                    placeholder="Enter content..."
                  />
                </div>
                <button
                  onClick={handleSave}
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
