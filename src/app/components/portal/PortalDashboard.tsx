import { Link, useOutletContext } from "react-router";
import { motion } from "motion/react";
import {
  Calendar,
  MessageCircle,
  FileText,
  CreditCard,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

export function PortalDashboard() {
  usePageTitle("Dashboard - Client Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();

  const cardBg = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const textPrimary = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const textSecondary = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const accent = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const accentBg = darkMode ? "bg-[#4A8C5C]/10" : "bg-[#1C4A3A]/10";

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${textPrimary} mb-8`}
        style={{ fontSize: "1.8rem" }}
      >
        Dashboard
      </motion.h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Project - Large */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`${cardBg} border rounded-2xl p-6 md:col-span-2 md:row-span-2`}
        >
          <div className="flex items-center justify-between mb-4">
            <span
              className={`text-[11px] uppercase tracking-[0.2em] ${accent}`}
            >
              Active Project
            </span>
            <Link
              to="/portal/projects"
              className={`text-[12px] ${accent} hover:underline`}
            >
              View Details
            </Link>
          </div>
          <h3 className={`${textPrimary} mt-2`} style={{ fontSize: "1.4rem" }}>
            Main Bedroom Renovation
          </h3>
          <p className={`${textSecondary} text-[13px] mt-1`}>
            Fitted bedroom with walk-in wardrobe
          </p>

          {/* Vertical Timeline */}
          <div className="mt-8 space-y-3">
            {[
              { stage: "Consultation", status: "completed", date: "Feb 1" },
              { stage: "Design", status: "current", date: "Feb 15" },
              { stage: "Approval", status: "upcoming", date: "Mar 10" },
              { stage: "Manufacturing", status: "upcoming", date: "Mar 25" },
              { stage: "Installation", status: "upcoming", date: "Apr 5" },
              { stage: "Completion", status: "upcoming", date: "Apr 15" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  {item.status === "completed" ? (
                    <div
                      className={`w-5 h-5 rounded-full ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"} flex items-center justify-center`}
                    >
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  ) : item.status === "current" ? (
                    <div
                      className={`w-5 h-5 rounded-full ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"} animate-pulse`}
                    />
                  ) : (
                    <div
                      className={`w-5 h-5 rounded-full border-2 ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]"}`}
                    />
                  )}
                  {i < 5 && (
                    <div
                      className={`w-px h-5 ${item.status === "completed" ? (darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]") : darkMode ? "bg-[#2A2A28]" : "bg-[#C4B8A8]"}`}
                    />
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <p
                    className={`text-[13px] ${item.status === "upcoming" ? textSecondary : textPrimary}`}
                    style={{
                      fontWeight: item.status === "current" ? 500 : 400,
                    }}
                  >
                    {item.stage}
                  </p>
                  <p className={`text-[11px] ${textSecondary}`}>{item.date}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            className={`mt-6 flex items-center gap-2 ${textSecondary} text-[13px]`}
          >
            <Clock size={14} />
            <span>Estimated completion: April 15, 2026</span>
          </div>
        </motion.div>

        {/* Upcoming Appointment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${cardBg} border rounded-2xl p-6`}
        >
          <div
            className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center mb-4`}
          >
            <Calendar size={18} className={accent} />
          </div>
          <span
            className={`text-[11px] uppercase tracking-[0.2em] ${textSecondary}`}
          >
            Upcoming
          </span>
          <h4 className={`${textPrimary} mt-1`} style={{ fontSize: "1rem" }}>
            Site Visit
          </h4>
          <p className={`${accent} text-[13px] mt-2`}>
            March 8, 2026 - 10:30am
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() =>
                toast.success(
                  "Added to calendar! Check your email for the calendar invite.",
                )
              }
              className={`px-3 py-1.5 rounded-full text-[11px] ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"}`}
            >
              Add to Calendar
            </button>
            <button
              onClick={() =>
                toast.success(
                  "Reschedule request sent! The team will contact you shortly.",
                )
              }
              className={`px-3 py-1.5 rounded-full text-[11px] border ${darkMode ? "border-[#2A2A28] text-[#8A8A82]" : "border-[#C4B8A8] text-[#6B6B65]"}`}
            >
              Reschedule
            </button>
          </div>
        </motion.div>

        {/* Unread Messages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`${cardBg} border rounded-2xl p-6`}
        >
          <div
            className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center mb-4`}
          >
            <MessageCircle size={18} className={accent} />
          </div>
          <span
            className={`text-[11px] uppercase tracking-[0.2em] ${textSecondary}`}
          >
            Messages
          </span>
          <h4 className={`${textPrimary} mt-1`} style={{ fontSize: "1rem" }}>
            2 Unread
          </h4>
          <p className={`${textSecondary} text-[13px] mt-2 line-clamp-2`}>
            "Hi Sarah, the design revisions are ready for your review..."
          </p>
          <Link
            to="/portal/messages"
            className={`inline-block mt-3 text-[12px] ${accent} hover:underline`}
          >
            Reply
          </Link>
        </motion.div>

        {/* Documents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${cardBg} border rounded-2xl p-6`}
        >
          <div
            className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center mb-4`}
          >
            <FileText size={18} className={accent} />
          </div>
          <span
            className={`text-[11px] uppercase tracking-[0.2em] ${textSecondary}`}
          >
            Documents
          </span>
          <h4 className={`${textPrimary} mt-1`} style={{ fontSize: "1rem" }}>
            8 Files
          </h4>
          <Link
            to="/portal/documents"
            className={`inline-block mt-3 text-[12px] ${accent} hover:underline`}
          >
            View All
          </Link>
        </motion.div>

        {/* Invoice Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className={`${cardBg} border rounded-2xl p-6`}
        >
          <div
            className={`w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4`}
          >
            <CreditCard size={18} className="text-amber-500" />
          </div>
          <span
            className={`text-[11px] uppercase tracking-[0.2em] ${textSecondary}`}
          >
            Outstanding
          </span>
          <h4
            className="text-amber-500 mt-1"
            style={{ fontSize: "1.2rem", fontWeight: 600 }}
          >
            &pound;2,400
          </h4>
          <Link to="/portal/invoices">
            <button
              className={`mt-3 px-4 py-1.5 rounded-full text-[11px] ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"}`}
            >
              Pay Now
            </button>
          </Link>
        </motion.div>

        {/* Project Timeline - Full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`${cardBg} border rounded-2xl p-6 md:col-span-2 lg:col-span-4`}
        >
          <h4 className={`${textPrimary} mb-6`} style={{ fontSize: "1rem" }}>
            Project Timeline
          </h4>
          <div className="flex items-center gap-0 overflow-x-auto">
            {[
              { label: "Initial Consultation", date: "Feb 10", done: true },
              { label: "Design Phase", date: "Feb 20", done: true },
              {
                label: "Design Review",
                date: "Mar 5",
                done: false,
                current: true,
              },
              { label: "Client Approval", date: "Mar 12", done: false },
              { label: "Manufacturing", date: "Mar 20", done: false },
              { label: "Installation", date: "Apr 10", done: false },
              { label: "Final Walkthrough", date: "Apr 15", done: false },
            ].map((item, i, arr) => (
              <div key={i} className="flex items-center flex-shrink-0">
                <div className="text-center">
                  <div
                    className={`w-4 h-4 rounded-full mx-auto ${
                      item.done
                        ? darkMode
                          ? "bg-[#4A8C5C]"
                          : "bg-[#1C4A3A]"
                        : item.current
                          ? "ring-2 ring-offset-2 " +
                            (darkMode
                              ? "bg-[#4A8C5C] ring-[#4A8C5C]/30 ring-offset-[#1C1C1A]"
                              : "bg-[#1C4A3A] ring-[#1C4A3A]/30 ring-offset-white")
                          : darkMode
                            ? "bg-[#2A2A28]"
                            : "bg-[#EAE7E0]"
                    }`}
                  >
                    {item.current && (
                      <motion.div
                        className={`w-full h-full rounded-full ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                    )}
                  </div>
                  <p
                    className={`text-[10px] mt-2 whitespace-nowrap ${item.done || item.current ? accent : textSecondary}`}
                  >
                    {item.label}
                  </p>
                  <p className={`text-[9px] ${textSecondary}`}>{item.date}</p>
                </div>
                {i < arr.length - 1 && (
                  <div
                    className={`w-12 h-px mx-1 flex-shrink-0 ${
                      item.done
                        ? darkMode
                          ? "bg-[#4A8C5C]"
                          : "bg-[#1C4A3A]"
                        : darkMode
                          ? "bg-[#2A2A28]"
                          : "bg-[#EAE7E0]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
