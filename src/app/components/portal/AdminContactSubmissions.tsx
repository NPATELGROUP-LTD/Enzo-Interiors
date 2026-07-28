import { useState } from "react";
import { useOutletContext } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  X,
  Mail,
  Phone,
  MessageCircle,
  Check,
  Trash2,
  Archive,
  Reply,
  Clock,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

const submissions = [
  {
    id: 1,
    name: "Alex Morrison",
    email: "alex@email.com",
    phone: "07XXX XXX010",
    service: "Bespoke Kitchen",
    message:
      "Hi, we've just moved into a new home in Oadby and are looking for a complete kitchen redesign. We love the sage green kitchen on your portfolio. Could we arrange a consultation?",
    date: "Mar 1, 2026",
    time: "10:30am",
    status: "New",
    source: "Website",
  },
  {
    id: 2,
    name: "Hannah Green",
    email: "hannah@email.com",
    phone: "07XXX XXX011",
    service: "Fitted Wardrobe",
    message:
      "I'm interested in a walk-in wardrobe for our master bedroom. We have a spare room that we'd like to convert. What would the approximate cost be?",
    date: "Feb 28, 2026",
    time: "3:15pm",
    status: "New",
    source: "Website",
  },
  {
    id: 3,
    name: "Marcus Williams",
    email: "marcus@email.com",
    phone: "07XXX XXX012",
    service: "Media Wall",
    message:
      "Looking for a media wall with integrated fireplace for our living room. We have a 65 inch TV. Can you do a home visit?",
    date: "Feb 27, 2026",
    time: "9:00am",
    status: "Replied",
    source: "Website",
  },
  {
    id: 4,
    name: "Sophie Bennett",
    email: "sophie.b@email.com",
    phone: "07XXX XXX013",
    service: "Fitted Bedroom",
    message:
      "We need fitted wardrobes and a dressing table for our new extension. The room is 4m x 5m. Available for consultation most weekdays.",
    date: "Feb 25, 2026",
    time: "11:45am",
    status: "Replied",
    source: "WhatsApp",
  },
  {
    id: 5,
    name: "Oliver Taylor",
    email: "oliver.t@email.com",
    phone: "07XXX XXX014",
    service: "Bespoke Kitchen",
    message:
      "Interested in a U-shaped kitchen design. Budget around £12k-15k. When is your earliest availability for a consultation?",
    date: "Feb 24, 2026",
    time: "4:30pm",
    status: "Converted",
    source: "Website",
  },
  {
    id: 6,
    name: "Nadia Khan",
    email: "nadia@email.com",
    phone: "07XXX XXX015",
    service: "Other",
    message:
      "Hi! We'd love to discuss a home office installation. Do you do bespoke desks and shelving?",
    date: "Feb 22, 2026",
    time: "2:00pm",
    status: "Archived",
    source: "Website",
  },
];

export function AdminContactSubmissions() {
  usePageTitle("Contact Submissions - Admin Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [selected, setSelected] = useState<(typeof submissions)[0] | null>(
    null,
  );
  const [replyText, setReplyText] = useState("");
  const [items, setItems] = useState(submissions);

  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const acc = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const accBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";

  const filtered = items
    .filter((s) => filterStatus === "All" || s.status === filterStatus)
    .filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()),
    );

  const statusColor = (s: string) => {
    if (s === "New")
      return darkMode
        ? "bg-blue-500/20 text-blue-400"
        : "bg-blue-500/10 text-blue-600";
    if (s === "Replied")
      return darkMode
        ? "bg-[#4A8C5C]/20 text-[#4A8C5C]"
        : "bg-[#1C4A3A]/10 text-[#1C4A3A]";
    if (s === "Converted") return "bg-amber-500/10 text-amber-500";
    return darkMode
      ? "bg-[#2A2A28] text-[#8A8A82]"
      : "bg-[#EAE7E0] text-[#6B6B65]";
  };

  const handleReply = () => {
    if (!selected || !replyText) return;
    toast.success(`Reply sent to ${selected.name}`);
    setItems(
      items.map((i) =>
        i.id === selected.id ? { ...i, status: "Replied" } : i,
      ),
    );
    setReplyText("");
  };

  const handleConvert = (id: number) => {
    setItems(
      items.map((i) => (i.id === id ? { ...i, status: "Converted" } : i)),
    );
    toast.success("Contact converted to client!");
  };

  const handleArchive = (id: number) => {
    setItems(
      items.map((i) => (i.id === id ? { ...i, status: "Archived" } : i)),
    );
    toast.success("Submission archived");
  };

  const handleDelete = (id: number) => {
    setItems(items.filter((i) => i.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success("Submission deleted");
  };

  const newCount = items.filter((i) => i.status === "New").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={t1}
            style={{ fontSize: "1.8rem" }}
          >
            Contact Submissions
          </motion.h1>
          {newCount > 0 && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] text-white ${accBg}`}
            >
              {newCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
          >
            <Search size={14} className={t2} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className={`bg-transparent text-[13px] focus:outline-none w-32 ${darkMode ? "text-[#F0EEE9] placeholder-[#8A8A82]" : "text-[#2C2C2C] placeholder-[#C4B8A8]"}`}
            />
          </div>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["All", "New", "Replied", "Converted", "Archived"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-[12px] transition-all ${filterStatus === s ? `text-white ${accBg}` : `${darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}`}
          >
            {s} {s === "New" && newCount > 0 ? `(${newCount})` : ""}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Submissions List */}
        <div className={`flex-1 ${c} border rounded-2xl overflow-hidden`}>
          {filtered.map((sub, i) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`p-4 cursor-pointer transition-colors border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/10"} ${selected?.id === sub.id ? (darkMode ? "bg-[#4A8C5C]/5" : "bg-[#1C4A3A]/5") : darkMode ? "hover:bg-[#2A2A28]/50" : "hover:bg-[#F5F4F0]"} ${sub.status === "New" ? (darkMode ? "border-l-2 border-l-blue-400" : "border-l-2 border-l-blue-500") : ""}`}
              onClick={() => setSelected(sub)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] text-white flex-shrink-0 ${sub.status === "New" ? "bg-blue-500" : accBg}`}
                  >
                    {sub.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p
                      className={`text-[13px] ${t1}`}
                      style={{ fontWeight: sub.status === "New" ? 600 : 400 }}
                    >
                      {sub.name}
                    </p>
                    <p className={`text-[11px] ${t2}`}>
                      {sub.service} &middot; {sub.date}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] flex-shrink-0 ${statusColor(sub.status)}`}
                >
                  {sub.status}
                </span>
              </div>
              <p className={`text-[12px] ${t2} mt-2 line-clamp-2`}>
                {sub.message}
              </p>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className={`p-8 text-center ${t2} text-[14px]`}>
              No submissions found
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`w-[400px] flex-shrink-0 ${c} border rounded-2xl p-6 hidden lg:block`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={t1} style={{ fontSize: "1.1rem" }}>
                  Submission Details
                </h3>
                <button
                  onClick={() => setSelected(null)}
                  className={`p-1 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
                >
                  <X size={16} className={t2} />
                </button>
              </div>

              <div
                className={`text-center py-4 mb-4 rounded-xl ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-[18px] text-white mx-auto ${accBg}`}
                >
                  {selected.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <h4 className={`mt-2 ${t1}`}>{selected.name}</h4>
                <span
                  className={`px-3 py-0.5 rounded-full text-[10px] ${statusColor(selected.status)}`}
                >
                  {selected.status}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <Mail size={14} className={acc} />
                  <span className={`text-[13px] ${t1}`}>{selected.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={14} className={acc} />
                  <span className={`text-[13px] ${t1}`}>{selected.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MessageCircle size={14} className={acc} />
                  <span className={`text-[13px] ${t1}`}>
                    {selected.service}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock size={14} className={t2} />
                  <span className={`text-[12px] ${t2}`}>
                    {selected.date} at {selected.time}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Filter size={14} className={t2} />
                  <span className={`text-[12px] ${t2}`}>
                    Source: {selected.source}
                  </span>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl mb-6 ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
              >
                <span className={`text-[11px] ${t2} block mb-2`}>Message</span>
                <p className={`text-[13px] ${t1} leading-relaxed`}>
                  {selected.message}
                </p>
              </div>

              {/* Reply */}
              <div className="mb-4">
                <label className={`text-[12px] ${t2} block mb-1`}>
                  Quick Reply
                </label>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  className={`w-full px-3 py-2 rounded-xl border text-[13px] focus:outline-none resize-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9] placeholder-[#8A8A82]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C] placeholder-[#C4B8A8]"}`}
                />
                <button
                  onClick={handleReply}
                  disabled={!replyText}
                  className={`mt-2 px-4 py-2 rounded-full text-[12px] text-white flex items-center gap-1.5 ${accBg} disabled:opacity-50`}
                >
                  <Reply size={12} /> Send Reply
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {selected.status !== "Converted" && (
                  <button
                    onClick={() => handleConvert(selected.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] flex items-center gap-1 border ${darkMode ? "border-[#4A8C5C] text-[#4A8C5C]" : "border-[#1C4A3A] text-[#1C4A3A]"}`}
                  >
                    <Check size={12} /> Convert to Client
                  </button>
                )}
                <button
                  onClick={() => handleArchive(selected.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] flex items-center gap-1 ${darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
                >
                  <Archive size={12} /> Archive
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="px-3 py-1.5 rounded-full text-[11px] flex items-center gap-1 bg-red-500/10 text-red-500"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
