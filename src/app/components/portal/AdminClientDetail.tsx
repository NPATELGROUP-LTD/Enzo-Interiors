import { useState } from "react";
import { useParams, useOutletContext, Link } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FolderKanban,
  FileText,
  Receipt,
  MessageCircle,
  Edit2,
  Trash2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const clientData: Record<
  string,
  {
    name: string;
    email: string;
    phone: string;
    address: string;
    joinedDate: string;
    totalSpent: string;
    activeProjects: number;
    projects: { id: string; name: string; status: string; value: string; date: string }[];
    invoices: { id: string; amount: string; status: string; date: string }[];
    documents: { name: string; date: string }[];
    notes: { text: string; author: string; date: string }[];
    activity: { action: string; time: string }[];
  }
> = {
  "1": {
    name: "Sarah Thompson",
    email: "sarah.t@email.com",
    phone: "+44 7700 900123",
    address: "15 Oak Avenue, Manchester, M14 5PQ",
    joinedDate: "Jan 15, 2026",
    totalSpent: "£45,000",
    activeProjects: 2,
    projects: [
      { id: "1", name: "Main Bedroom Renovation", status: "In Design", value: "£22,000", date: "Feb 1, 2026" },
      { id: "2", name: "Kitchen Remodel", status: "Consultation", value: "£35,000", date: "Mar 5, 2026" },
    ],
    invoices: [
      { id: "INV-001", amount: "£11,000", status: "Paid", date: "Feb 15, 2026" },
      { id: "INV-002", amount: "£11,000", status: "Pending", date: "Mar 1, 2026" },
    ],
    documents: [
      { name: "Bedroom Design - V3.pdf", date: "Feb 28, 2026" },
      { name: "Contract - Main Bedroom.pdf", date: "Feb 10, 2026" },
    ],
    notes: [
      { text: "Client prefers minimalist designs with natural materials", author: "Oyz Khan", date: "Feb 1" },
      { text: "Budget flexible for quality finishes", author: "Design Team", date: "Feb 8" },
    ],
    activity: [
      { action: "Paid Invoice INV-001 (£11,000)", time: "2 days ago" },
      { action: "Approved Bedroom Design V3", time: "1 week ago" },
      { action: "Consultation meeting completed", time: "2 weeks ago" },
      { action: "Signed contract", time: "3 weeks ago" },
    ],
  },
};

export function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "documents" | "invoices" | "notes" | "activity">("overview");
  const [newNote, setNewNote] = useState("");

  const client = clientData[id || "1"] || clientData["1"];

  const cardBg = darkMode ? "bg-[#1C1C1A] border-[#2A2A28]" : "bg-white border-[#C4B8A8]/20";
  const textPrimary = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const textSecondary = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const accent = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const accentBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "projects", label: "Projects" },
    { id: "invoices", label: "Invoices" },
    { id: "documents", label: "Documents" },
    { id: "notes", label: "Notes" },
    { id: "activity", label: "Activity" },
  ] as const;

  return (
    <div>
      {/* Sticky Header */}
      <div
        className={`sticky top-0 z-40 backdrop-blur-xl ${darkMode ? "bg-[#111110]/95" : "bg-[#F5F4F0]/95"} pb-4 -mx-4 md:-mx-8 px-4 md:px-8 pt-6`}
      >
        <Link
          to="/admin/clients"
          className={`inline-flex items-center gap-2 text-[13px] ${accent} hover:underline mb-4`}
        >
          <ArrowLeft size={14} /> Back to Clients
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl ${accentBg} flex items-center justify-center text-white text-xl`}>
              {client.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={textPrimary}
                style={{ fontSize: "1.8rem" }}
              >
                {client.name}
              </motion.h1>
              <div className="flex flex-wrap gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <Mail size={13} className={textSecondary} />
                  <span className={`text-[12px] ${textSecondary}`}>{client.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={13} className={textSecondary} />
                  <span className={`text-[12px] ${textSecondary}`}>{client.phone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className={textSecondary} />
                  <span className={`text-[12px] ${textSecondary}`}>{client.address}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => toast.success("Edit functionality not yet implemented")}
              className={`px-4 py-2 rounded-full text-[12px] ${darkMode ? "bg-[#2A2A28] text-[#F0EEE9]" : "bg-[#EAE7E0] text-[#1C4A3A]"} hover:opacity-80`}
            >
              <Edit2 size={12} className="inline mr-1.5" />
              Edit
            </button>
            <button
              onClick={() => toast.error("Delete client?")}
              className="px-4 py-2 rounded-full text-[12px] bg-red-500/10 text-red-500 hover:bg-red-500/20"
            >
              <Trash2 size={12} className="inline mr-1.5" />
              Delete
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-[12px] whitespace-nowrap transition-all ${activeTab === tab.id ? `${accentBg} text-white` : darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="space-y-6 mt-6">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${cardBg} border rounded-2xl p-6`}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className={accent} />
                <span className={`text-[11px] uppercase tracking-wider ${textSecondary}`}>
                  Client Since
                </span>
              </div>
              <p className={`text-2xl ${textPrimary}`}>{client.joinedDate}</p>
            </div>
            <div className={`${cardBg} border rounded-2xl p-6`}>
              <div className="flex items-center gap-2 mb-2">
                <Receipt size={16} className={accent} />
                <span className={`text-[11px] uppercase tracking-wider ${textSecondary}`}>
                  Total Spent
                </span>
              </div>
              <p className={`text-2xl ${textPrimary}`}>{client.totalSpent}</p>
            </div>
            <div className={`${cardBg} border rounded-2xl p-6`}>
              <div className="flex items-center gap-2 mb-2">
                <FolderKanban size={16} className={accent} />
                <span className={`text-[11px] uppercase tracking-wider ${textSecondary}`}>
                  Active Projects
                </span>
              </div>
              <p className={`text-2xl ${textPrimary}`}>{client.activeProjects}</p>
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <div className={`${cardBg} border rounded-2xl overflow-hidden`}>
            <div className="p-6 border-b border-inherit">
              <div className="flex items-center justify-between">
                <span className={`text-[11px] uppercase tracking-[0.2em] ${accent}`}>
                  All Projects
                </span>
                <button
                  onClick={() => toast.success("Create project functionality")}
                  className={`px-3 py-1.5 rounded-full text-[11px] ${accentBg} text-white`}
                >
                  <Plus size={10} className="inline mr-1" />
                  New Project
                </button>
              </div>
            </div>
            <div className="divide-y divide-inherit">
              {client.projects.map((project) => (
                <div key={project.id} className="p-6 hover:bg-opacity-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Link
                        to={`/admin/projects`}
                        className={`text-[14px] ${textPrimary} hover:${accent} transition-colors font-medium`}
                      >
                        {project.name}
                        <ExternalLink size={12} className="inline ml-1.5" />
                      </Link>
                      <div className="flex items-center gap-4 mt-2">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] ${darkMode ? "bg-[#4A8C5C]/20 text-[#4A8C5C]" : "bg-[#1C4A3A]/10 text-[#1C4A3A]"}`}
                        >
                          {project.status}
                        </span>
                        <span className={`text-[12px] ${textSecondary}`}>
                          Started {project.date}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-[15px] ${textPrimary} font-medium`}>{project.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className={`${cardBg} border rounded-2xl overflow-hidden`}>
            <div className="p-6 border-b border-inherit">
              <span className={`text-[11px] uppercase tracking-[0.2em] ${accent}`}>
                Invoices
              </span>
            </div>
            <div className="divide-y divide-inherit">
              {client.invoices.map((invoice) => (
                <div key={invoice.id} className="p-6 flex items-center justify-between">
                  <div>
                    <p className={`text-[13px] ${textPrimary} font-medium`}>{invoice.id}</p>
                    <p className={`text-[11px] ${textSecondary} mt-1`}>{invoice.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] ${invoice.status === "Paid" ? darkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600" : "bg-amber-500/20 text-amber-500"}`}
                    >
                      {invoice.status}
                    </span>
                    <p className={`text-[14px] ${textPrimary} font-medium`}>{invoice.amount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className={`${cardBg} border rounded-2xl p-6`}>
            <span className={`text-[11px] uppercase tracking-[0.2em] ${accent} block mb-6`}>
              Documents
            </span>
            <div className="space-y-3">
              {client.documents.map((doc, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-4 rounded-xl ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText size={18} className={accent} />
                    <div>
                      <p className={`text-[13px] ${textPrimary}`}>{doc.name}</p>
                      <p className={`text-[11px] ${textSecondary}`}>{doc.date}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toast.success(`Viewing ${doc.name}`)}
                    className={`px-3 py-1.5 rounded-full text-[11px] ${darkMode ? "bg-[#2A2A28] hover:bg-[#1C1C1A]" : "bg-white hover:bg-[#EAE7E0]"} ${accent}`}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className={`${cardBg} border rounded-2xl p-6`}>
            <span className={`text-[11px] uppercase tracking-[0.2em] ${accent} block mb-6`}>
              Internal Notes
            </span>
            <div className="space-y-4 mb-6">
              {client.notes.map((note, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
                >
                  <p className={`text-[13px] ${textPrimary} mb-2`}>{note.text}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] ${accent}`}>{note.author}</span>
                    <span className={`text-[11px] ${textSecondary}`}>&middot; {note.date}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className={`flex-1 px-4 py-3 rounded-xl border ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9] placeholder-[#8A8A82]" : "bg-[#F5F4F0] border-[#C4B8A8]/20 text-[#2C2C2C] placeholder-[#C4B8A8]"} focus:outline-none text-[13px]`}
              />
              <button
                onClick={() => {
                  if (newNote.trim()) {
                    toast.success("Note added");
                    setNewNote("");
                  }
                }}
                className={`px-6 py-3 rounded-xl ${accentBg} text-white text-[13px]`}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className={`${cardBg} border rounded-2xl p-6`}>
            <span className={`text-[11px] uppercase tracking-[0.2em] ${accent} block mb-6`}>
              Recent Activity
            </span>
            <div className="space-y-4">
              {client.activity.map((act, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full ${accentBg} mt-2`} />
                  <div className="flex-1">
                    <p className={`text-[13px] ${textPrimary}`}>{act.action}</p>
                    <p className={`text-[11px] ${textSecondary} mt-1`}>{act.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
