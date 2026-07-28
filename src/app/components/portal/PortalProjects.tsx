import { Link, useOutletContext } from "react-router";
import { motion } from "motion/react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

const BEDROOM_IMG =
  "https://images.unsplash.com/photo-1709544345907-ceea96cb69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXNwb2tlJTIwZml0dGVkJTIwYmVkcm9vbSUyMHdhcm0lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzIzOTgyMzF8MA&ixlib=rb-4.1.0&q=80&w=1080";
const KITCHEN_IMG =
  "https://images.unsplash.com/photo-1721522282337-6b6d3e366463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBraXRjaGVuJTIwc2FnZSUyMGdyZWVuJTIwZml0dGVkfGVufDF8fHx8MTc3MjM5ODIzMnww&ixlib=rb-4.1.0&q=80&w=1080";

const projects = [
  {
    id: 1,
    title: "Main Bedroom Renovation",
    type: "Bedroom",
    status: "In Progress",
    progress: 50,
    startDate: "Feb 10, 2026",
    completion: "Apr 15, 2026",
    image: BEDROOM_IMG,
  },
  {
    id: 2,
    title: "Kitchen Redesign",
    type: "Kitchen",
    status: "Completed",
    progress: 100,
    startDate: "Oct 5, 2025",
    completion: "Dec 20, 2025",
    image: KITCHEN_IMG,
  },
];

export function PortalProjects() {
  usePageTitle("Projects - Client Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const cardBg = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const textPrimary = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const textSecondary = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const accent = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={textPrimary}
          style={{ fontSize: "1.8rem" }}
        >
          My Projects
        </motion.h1>
        <button
          onClick={() =>
            toast.success(
              "Project request submitted! The team will reach out within 24 hours.",
            )
          }
          className={`px-5 py-2 rounded-full text-[13px] ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"}`}
        >
          + Request Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${cardBg} border rounded-2xl overflow-hidden hover:-translate-y-1 transition-transform duration-300 cursor-pointer`}
          >
            <div className="h-48 overflow-hidden">
              <ImageWithFallback
                src={project.image}
                alt={project.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] ${
                    project.status === "In Progress"
                      ? darkMode
                        ? "bg-[#4A8C5C]/20 text-[#4A8C5C]"
                        : "bg-[#1C4A3A]/10 text-[#1C4A3A]"
                      : "bg-[#8A9E8C]/20 text-[#8A9E8C]"
                  }`}
                >
                  {project.status}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] ${darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
                >
                  {project.type}
                </span>
              </div>
              <h3 className={textPrimary} style={{ fontSize: "1.2rem" }}>
                {project.title}
              </h3>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className={textSecondary}>Progress</span>
                  <span className={accent}>{project.progress}%</span>
                </div>
                <div
                  className={`h-1.5 rounded-full ${darkMode ? "bg-[#2A2A28]" : "bg-[#EAE7E0]"}`}
                >
                  <div
                    className={`h-full rounded-full ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  to={`/portal/projects/${project.id}`}
                  className={`flex-1 py-2 px-4 rounded-full text-[12px] text-center ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"}`}
                >
                  View Details
                </Link>
              </div>
              <div
                className={`mt-3 flex justify-between text-[12px] ${textSecondary}`}
              >
                <span>Started: {project.startDate}</span>
                <span>Est: {project.completion}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => toast.success("Opening project details...")}
                  className={`px-4 py-1.5 rounded-full text-[12px] ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"}`}
                >
                  View Details
                </button>
                <Link
                  to="/portal/messages"
                  className={`px-4 py-1.5 rounded-full text-[12px] border ${darkMode ? "border-[#2A2A28] text-[#8A8A82]" : "border-[#C4B8A8] text-[#6B6B65]"}`}
                >
                  Message Team
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
