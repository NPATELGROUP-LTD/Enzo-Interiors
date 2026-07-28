import { useState } from "react";
import { useParams, useOutletContext, Link } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  FileText,
  MessageCircle,
  Download,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";

const projectData: Record<
  string,
  {
    name: string;
    client: string;
    location: string;
    image: string;
    status: string;
    startDate: string;
    endDate: string;
    progress: number;
    timeline: {
      stage: string;
      status: "completed" | "current" | "upcoming";
      date: string;
    }[];
    documents: { name: string; date: string; size: string }[];
    messages: { sender: string; text: string; time: string }[];
    description: string;
  }
> = {
  "1": {
    name: "Main Bedroom Renovation",
    client: "Sarah Thompson",
    location: "15 Oak Avenue, Manchester",
    image: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800",
    status: "In Design",
    startDate: "Feb 1, 2026",
    endDate: "Apr 30, 2026",
    progress: 35,
    timeline: [
      { stage: "Consultation", status: "completed", date: "Feb 1" },
      { stage: "Design", status: "current", date: "Feb 15" },
      { stage: "Manufacturing", status: "upcoming", date: "Mar 10" },
      { stage: "Installation", status: "upcoming", date: "Apr 5" },
      { stage: "Completion", status: "upcoming", date: "Apr 30" },
    ],
    documents: [
      { name: "Bedroom Design - V3.pdf", date: "Feb 28", size: "2.4 MB" },
      { name: "Contract - Main Bedroom.pdf", date: "Feb 10", size: "340 KB" },
      { name: "Quote - Bedroom Renovation.pdf", date: "Feb 8", size: "180 KB" },
    ],
    messages: [
      {
        sender: "Oyz Khan",
        text: "Hi Sarah, the updated renders are ready!",
        time: "2h ago",
      },
      {
        sender: "You",
        text: "That looks perfect! When do we start?",
        time: "1h ago",
      },
      {
        sender: "Oyz Khan",
        text: "Manufacturing begins March 10th",
        time: "30m ago",
      },
    ],
    description:
      "Complete bedroom renovation including custom wardrobe, bedside tables, and feature wall paneling. Luxury finish with integrated LED lighting.",
  },
};

export function PortalProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [activeTab, setActiveTab] = useState<
    "overview" | "documents" | "messages"
  >("overview");

  const project = projectData[id || "1"] || projectData["1"];

  const cardBg = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const textPrimary = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const textSecondary = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const accent = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const accentBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";

  return (
    <div>
      {/* Sticky Header */}
      <div
        className={`sticky top-0 z-40 backdrop-blur-xl ${darkMode ? "bg-[#111110]/95" : "bg-[#F5F4F0]/95"} pb-4 -mx-4 md:-mx-8 px-4 md:px-8 pt-6`}
      >
        <Link
          to="/portal/projects"
          className={`inline-flex items-center gap-2 text-[13px] ${accent} hover:underline mb-4`}
        >
          <ArrowLeft size={14} /> Back to Projects
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={textPrimary}
              style={{ fontSize: "1.8rem" }}
            >
              {project.name}
            </motion.h1>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-2">
                <User size={14} className={textSecondary} />
                <span className={`text-[13px] ${textSecondary}`}>
                  {project.client}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} className={textSecondary} />
                <span className={`text-[13px] ${textSecondary}`}>
                  {project.location}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className={textSecondary} />
                <span className={`text-[13px] ${textSecondary}`}>
                  {project.startDate} - {project.endDate}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-full text-[12px] transition-all ${activeTab === "overview" ? `${accentBg} text-white` : darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-4 py-2 rounded-full text-[12px] transition-all ${activeTab === "documents" ? `${accentBg} text-white` : darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab("messages")}
              className={`px-4 py-2 rounded-full text-[12px] transition-all ${activeTab === "messages" ? `${accentBg} text-white` : darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
            >
              Messages
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="space-y-6 mt-6">
        {/* Hero Image */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl overflow-hidden h-80"
        >
          <img
            src={project.image}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        </motion.div>

        {activeTab === "overview" && (
          <>
            {/* Status & Progress */}
            <div className={`${cardBg} border rounded-2xl p-6`}>
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-[11px] uppercase tracking-[0.2em] ${accent}`}
                >
                  Project Status
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] ${darkMode ? "bg-[#4A8C5C]/20 text-[#4A8C5C]" : "bg-[#1C4A3A]/10 text-[#1C4A3A]"}`}
                >
                  {project.status}
                </span>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-[13px] mb-2">
                  <span className={textSecondary}>Overall Progress</span>
                  <span className={textPrimary}>{project.progress}%</span>
                </div>
                <div
                  className={`h-2 rounded-full ${darkMode ? "bg-[#2A2A28]" : "bg-[#EAE7E0]"}`}
                >
                  <div
                    className={`h-full rounded-full ${accentBg}`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className={`${cardBg} border rounded-2xl p-6`}>
              <span
                className={`text-[11px] uppercase tracking-[0.2em] ${accent} block mb-6`}
              >
                Project Timeline
              </span>
              <div className="space-y-4">
                {project.timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      {t.status === "completed" ? (
                        <CheckCircle2 size={20} className={accent} />
                      ) : t.status === "current" ? (
                        <div
                          className={`w-5 h-5 rounded-full ${accentBg} animate-pulse`}
                        />
                      ) : (
                        <Circle size={20} className={textSecondary} />
                      )}
                      {i < project.timeline.length - 1 && (
                        <div
                          className={`w-px h-8 ${t.status === "completed" ? accentBg : darkMode ? "bg-[#2A2A28]" : "bg-[#C4B8A8]"}`}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-[14px] ${t.status === "upcoming" ? textSecondary : textPrimary}`}
                      >
                        {t.stage}
                      </p>
                      <p className={`text-[12px] ${textSecondary}`}>{t.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className={`${cardBg} border rounded-2xl p-6`}>
              <span
                className={`text-[11px] uppercase tracking-[0.2em] ${accent} block mb-4`}
              >
                Description
              </span>
              <p className={`text-[14px] ${textSecondary} leading-relaxed`}>
                {project.description}
              </p>
            </div>
          </>
        )}

        {activeTab === "documents" && (
          <div className={`${cardBg} border rounded-2xl p-6`}>
            <span
              className={`text-[11px] uppercase tracking-[0.2em] ${accent} block mb-6`}
            >
              Project Documents
            </span>
            <div className="space-y-3">
              {project.documents.map((doc, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-4 rounded-xl ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText size={18} className={accent} />
                    <div>
                      <p className={`text-[13px] ${textPrimary}`}>{doc.name}</p>
                      <p className={`text-[11px] ${textSecondary}`}>
                        {doc.date} &middot; {doc.size}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toast.success(`Downloading ${doc.name}`)}
                    className={`p-2 rounded-full ${darkMode ? "hover:bg-[#1C1C1A]" : "hover:bg-white"} transition-colors`}
                  >
                    <Download size={16} className={accent} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className={`${cardBg} border rounded-2xl p-6`}>
            <span
              className={`text-[11px] uppercase tracking-[0.2em] ${accent} block mb-6`}
            >
              Project Messages
            </span>
            <div className="space-y-4">
              {project.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl ${msg.sender === "You" ? (darkMode ? "bg-[#4A8C5C]/20" : "bg-[#1C4A3A]/10") : darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[12px] ${textPrimary} font-medium`}>
                      {msg.sender}
                    </span>
                    <span className={`text-[10px] ${textSecondary}`}>
                      {msg.time}
                    </span>
                  </div>
                  <p className={`text-[13px] ${textSecondary}`}>{msg.text}</p>
                </div>
              ))}
              <button
                className={`w-full py-3 rounded-xl border ${darkMode ? "border-[#2A2A28] hover:bg-[#2A2A28]/50" : "border-[#C4B8A8]/20 hover:bg-[#F5F4F0]"} text-[13px] ${accent} transition-colors`}
              >
                <MessageCircle size={14} className="inline mr-2" />
                Start New Conversation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
