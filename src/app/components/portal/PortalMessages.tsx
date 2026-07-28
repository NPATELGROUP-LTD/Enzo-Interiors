import { useState, useRef, useEffect } from "react";
import { useOutletContext, useLocation, Link } from "react-router";
import {
  Send,
  Paperclip,
  Search,
  Image,
  Smile,
  Check,
  CheckCheck,
  ArrowLeft,
  Home,
  Folder,
  MessageCircle,
  FileText,
  Receipt,
  Settings,
  Sun,
  Moon,
  Bell,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useNotifications } from "../../hooks/useNotifications";
import { usePageTitle } from "../../hooks/usePageTitle";
import { EmojiPicker } from "../shared/EmojiPicker";

const dockItems = [
  { Icon: Home, label: "Dashboard", path: "/portal/dashboard" },
  { Icon: Folder, label: "Projects", path: "/portal/projects" },
  { Icon: MessageCircle, label: "Messages", path: "/portal/messages" },
  { Icon: FileText, label: "Documents", path: "/portal/documents" },
  { Icon: Receipt, label: "Invoices", path: "/portal/invoices" },
  { Icon: Settings, label: "Settings", path: "/portal/settings" },
];

const conversations = [
  {
    id: 1,
    name: "Enzo Interiors Team",
    avatar: "EI",
    lastMsg: "The design revisions are ready for your review.",
    time: "2h",
    unread: 2,
    online: true,
    project: "Bedroom Renovation",
  },
  {
    id: 2,
    name: "Oliver Kent - Designer",
    avatar: "OK",
    lastMsg: "I'll send you the fabric samples tomorrow",
    time: "1d",
    unread: 0,
    online: false,
    project: "Bedroom Renovation",
  },
  {
    id: 3,
    name: "Accounts & Invoices",
    avatar: "AI",
    lastMsg: "Your payment has been received. Thank you!",
    time: "3d",
    unread: 0,
    online: false,
    project: "General",
  },
  {
    id: 4,
    name: "Installation Team",
    avatar: "IT",
    lastMsg: "We can schedule for next Monday at 9am",
    time: "5d",
    unread: 0,
    online: false,
    project: "Kitchen Install",
  },
];

type Message = {
  id: number;
  from: string;
  text: string;
  time: string;
  read: boolean;
};

const initialMessages: Record<number, Message[]> = {
  1: [
    {
      id: 1,
      from: "team",
      text: "Hi Sarah! Hope you're having a great week. We've been working on the design revisions for your bedroom.",
      time: "10:30am",
      read: true,
    },
    {
      id: 2,
      from: "team",
      text: "I've updated the wardrobe configuration based on your feedback. The internal layout now includes the additional shoe rack you mentioned.",
      time: "10:32am",
      read: true,
    },
    {
      id: 3,
      from: "client",
      text: "That sounds great! Can I see the updated 3D renders?",
      time: "11:15am",
      read: true,
    },
    {
      id: 4,
      from: "team",
      text: "Of course! I've uploaded the new renders to your Documents section. You can also find them attached here.",
      time: "11:45am",
      read: true,
    },
    {
      id: 5,
      from: "client",
      text: "Perfect, thank you! The wardrobe looks exactly how I wanted it.",
      time: "1:20pm",
      read: true,
    },
    {
      id: 6,
      from: "team",
      text: "Wonderful! Shall we schedule a call to discuss the next steps? The design revisions are ready for your review.",
      time: "2h ago",
      read: false,
    },
  ],
  2: [
    {
      id: 1,
      from: "team",
      text: "Hi Sarah, I'm Oliver, your designer for the bedroom project.",
      time: "Monday",
      read: true,
    },
    {
      id: 2,
      from: "client",
      text: "Hi Oliver! Nice to meet you.",
      time: "Monday",
      read: true,
    },
    {
      id: 3,
      from: "team",
      text: "I'll send you the fabric samples tomorrow",
      time: "Yesterday",
      read: true,
    },
  ],
  3: [
    {
      id: 1,
      from: "team",
      text: "Your invoice #001 has been issued.",
      time: "5d ago",
      read: true,
    },
    {
      id: 2,
      from: "client",
      text: "Payment sent via bank transfer",
      time: "4d ago",
      read: true,
    },
    {
      id: 3,
      from: "team",
      text: "Your payment has been received. Thank you!",
      time: "3d ago",
      read: true,
    },
  ],
  4: [
    {
      id: 1,
      from: "team",
      text: "Hi Sarah, this is the installation team. We're excited to get started on your kitchen!",
      time: "Last week",
      read: true,
    },
    {
      id: 2,
      from: "client",
      text: "Looking forward to it! When can you start?",
      time: "Last week",
      read: true,
    },
    {
      id: 3,
      from: "team",
      text: "We can schedule for next Monday at 9am",
      time: "5d ago",
      read: true,
    },
  ],
};

export function PortalMessages() {
  usePageTitle("Messages - Client Portal");
  const { darkMode, toggleDarkMode } = useOutletContext<{
    darkMode: boolean;
    toggleDarkMode: () => void;
  }>();
  const location = useLocation();
  const [selectedConv, setSelectedConv] = useState(conversations[0]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [allMessages, setAllMessages] = useState(initialMessages);
  const [showMobileList, setShowMobileList] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { notifications, markRead, markAllRead, unreadCount } =
    useNotifications([
      {
        type: "design",
        text: "New design renders uploaded",
        time: "2h ago",
        read: false,
      },
      {
        type: "message",
        text: "Message from Oliver Kent",
        time: "5h ago",
        read: false,
      },
      {
        type: "invoice",
        text: "Invoice #002 is due soon",
        time: "1d ago",
        read: true,
      },
    ]);

  const messages = allMessages[selectedConv.id] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now(),
      from: "client",
      text: input,
      time: "Just now",
      read: false,
    };
    setAllMessages({
      ...allMessages,
      [selectedConv.id]: [...messages, newMsg],
    });
    setInput("");
    toast.success("Message sent");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const accBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";

  const filteredConvs = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      className={`h-screen flex ${darkMode ? "bg-[#111110]" : "bg-[#F5F4F0]"}`}
    >
      {/* Conversations sidebar */}
      <div
        className={`${showMobileList ? "flex" : "hidden"} md:flex flex-col w-full md:w-80 lg:w-96 border-r ${darkMode ? "border-[#2A2A28] bg-[#1C1C1A]" : "border-[#C4B8A8]/20 bg-white"} flex-shrink-0`}
      >
        <div
          className={`p-4 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
        >
          <h2 className={`${t1} mb-3`} style={{ fontSize: "1.3rem" }}>
            My Messages
          </h2>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
          >
            <Search size={14} className={t2} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className={`bg-transparent text-[13px] focus:outline-none w-full ${darkMode ? "text-[#F0EEE9] placeholder-[#8A8A82]" : "text-[#2C2C2C] placeholder-[#C4B8A8]"}`}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.map((conv) => (
            <div
              key={conv.id}
              onClick={() => {
                setSelectedConv(conv);
                setShowMobileList(false);
              }}
              className={`p-4 cursor-pointer transition-colors ${selectedConv.id === conv.id ? (darkMode ? "bg-[#4A8C5C]/10" : "bg-[#1C4A3A]/5") : darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] text-white ${accBg}`}
                  >
                    {conv.avatar}
                  </div>
                  {conv.online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-[#1C1C1A]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <span
                      className={`text-[13px] ${t1}`}
                      style={{ fontWeight: conv.unread > 0 ? 600 : 400 }}
                    >
                      {conv.name}
                    </span>
                    <span className={`text-[10px] ${t2}`}>{conv.time}</span>
                  </div>
                  <p className={`text-[11px] ${t2} truncate mt-0.5`}>
                    {conv.project}
                  </p>
                  <p
                    className={`text-[11px] ${conv.unread > 0 ? t1 : t2} truncate mt-0.5`}
                  >
                    {conv.lastMsg}
                  </p>
                </div>
                {conv.unread > 0 && (
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white flex-shrink-0 ${accBg}`}
                  >
                    {conv.unread}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Dock integrated in sidebar */}
        <div
          className={`p-3 border-t ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
        >
          <div
            className={`px-2 py-2 rounded-2xl flex flex-col gap-2 backdrop-blur-xl ${
              darkMode
                ? "bg-[#1E1E1C]/70 border border-[#2A2A28]"
                : "bg-white/60 border border-[#C4B8A8]/30"
            } shadow-lg`}
          >
            {/* Navigation Icons */}
            <div className="grid grid-cols-6 gap-1">
              {dockItems.map(({ Icon, label, path }) => {
                const isActive = location.pathname === path;
                return (
                  <Link key={path} to={path} className="relative group">
                    <motion.div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isActive
                          ? darkMode
                            ? "bg-[#4A8C5C]/20"
                            : "bg-[#1C4A3A]/10"
                          : darkMode
                            ? "hover:bg-[#2A2A28]"
                            : "hover:bg-[#F2F0EB]"
                      }`}
                      whileHover={{ scale: 1.1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                    >
                      <Icon
                        size={18}
                        className={
                          isActive
                            ? darkMode
                              ? "text-[#4A8C5C]"
                              : "text-[#1C4A3A]"
                            : darkMode
                              ? "text-[#F0EEE9]/50"
                              : "text-[#6B6B65]"
                        }
                      />
                    </motion.div>
                    {isActive && (
                      <div
                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                          darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"
                        }`}
                      />
                    )}
                    <div
                      className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                        darkMode
                          ? "bg-[#2A2A28] text-[#F0EEE9]"
                          : "bg-[#1C4A3A] text-white"
                      }`}
                    >
                      {label}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Utility row */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <Link to="/portal/dashboard" className="relative group">
                  <motion.div
                    className={`w-10 h-10 rounded-full ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"} flex items-center justify-center text-white text-[11px] hover:opacity-80`}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    ST
                  </motion.div>
                  <div
                    className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${darkMode ? "bg-[#2A2A28] text-[#F0EEE9]" : "bg-[#1C4A3A] text-white"}`}
                  >
                    Profile
                  </div>
                </Link>
                <button onClick={toggleDarkMode} className="relative group">
                  <motion.div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F2F0EB]"}`}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    {darkMode ? (
                      <Sun size={18} className="text-[#F0EEE9]/50" />
                    ) : (
                      <Moon size={18} className="text-[#6B6B65]" />
                    )}
                  </motion.div>
                  <div
                    className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${darkMode ? "bg-[#2A2A28] text-[#F0EEE9]" : "bg-[#1C4A3A] text-white"}`}
                  >
                    Theme
                  </div>
                </button>
              </div>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative group"
                  >
                    <motion.div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F2F0EB]"}`}
                      whileHover={{ scale: 1.1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                    >
                      <Bell
                        size={18}
                        className={
                          darkMode ? "text-[#F0EEE9]/50" : "text-[#6B6B65]"
                        }
                      />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className={`absolute right-0 bottom-12 w-72 rounded-2xl shadow-2xl overflow-hidden z-50 ${darkMode ? "bg-[#1C1C1A] border border-[#2A2A28]" : "bg-white border border-[#C4B8A8]/20"}`}
                      >
                        <div
                          className={`px-4 py-3 flex items-center justify-between border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                        >
                          <span
                            className={`text-[13px] ${darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]"}`}
                            style={{ fontWeight: 500 }}
                          >
                            Notifications
                          </span>
                          <button
                            onClick={() => {
                              markAllRead();
                              toast.success("All marked as read");
                            }}
                            className={`text-[11px] ${darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]"}`}
                          >
                            Mark all read
                          </button>
                        </div>
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => markRead(n.id)}
                            className={`px-4 py-3 flex items-start gap-3 ${!n.read ? (darkMode ? "bg-[#4A8C5C]/5" : "bg-[#1C4A3A]/5") : ""} ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"} transition-colors cursor-pointer`}
                          >
                            {!n.read && (
                              <div
                                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                              />
                            )}
                            <div>
                              <p
                                className={`text-[12px] ${darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]"}`}
                              >
                                {n.text}
                              </p>
                              <p
                                className={`text-[10px] ${darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]"} mt-0.5`}
                              >
                                {n.time}
                              </p>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Link to="/" className="relative group">
                  <motion.div
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500/10"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    <LogOut size={18} className="text-red-500" />
                  </motion.div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div
        className={`flex-1 flex flex-col ${showMobileList ? "hidden md:flex" : "flex"}`}
      >
        {/* Chat header */}
        <div
          className={`p-4 border-b flex items-center justify-between ${darkMode ? "border-[#2A2A28] bg-[#1C1C1A]" : "border-[#C4B8A8]/20 bg-white"}`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileList(true)}
              className="md:hidden"
            >
              <ArrowLeft size={20} className={t1} />
            </button>
            <div className="relative">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] text-white ${accBg}`}
              >
                {selectedConv.avatar}
              </div>
              {selectedConv.online && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-[#1C1C1A]" />
              )}
            </div>
            <div>
              <p className={`text-[14px] ${t1}`} style={{ fontWeight: 500 }}>
                {selectedConv.name}
              </p>
              <p
                className={`text-[11px] ${selectedConv.online ? "text-green-500" : t2}`}
              >
                {selectedConv.online ? "Online" : "Offline"} &middot;{" "}
                {selectedConv.project}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          className={`flex-1 overflow-y-auto p-6 space-y-4 ${darkMode ? "bg-[#111110]" : "bg-[#F5F4F0]"}`}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.from === "client" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[65%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${msg.from === "client" ? `${accBg} text-white` : darkMode ? "bg-[#1C1C1A] text-[#F0EEE9] border border-[#2A2A28]" : "bg-white text-[#2C2C2C] border border-[#C4B8A8]/20"}`}
              >
                {msg.text}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 ${msg.from === "client" ? "text-white/50" : t2}`}
                >
                  <span className="text-[10px]">{msg.time}</span>
                  {msg.from === "client" &&
                    (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className={`p-4 border-t ${darkMode ? "border-[#2A2A28] bg-[#1C1C1A]" : "border-[#C4B8A8]/20 bg-white"}`}
        >
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  toast.success(`File "${e.target.files[0].name}" attached`);
                  e.target.value = "";
                }
              }}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  toast.success(`Image "${e.target.files[0].name}" attached`);
                  e.target.value = "";
                }
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-2 rounded-xl ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
            >
              <Paperclip size={18} className={t2} />
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className={`p-2 rounded-xl ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
            >
              <Image size={18} className={t2} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className={`flex-1 px-4 py-3 rounded-xl text-[13px] ${darkMode ? "bg-[#2A2A28] text-[#F0EEE9] placeholder-[#8A8A82]" : "bg-[#F5F4F0] text-[#2C2C2C] placeholder-[#C4B8A8]"} focus:outline-none`}
            />
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-xl ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"} relative`}
            >
              <Smile size={18} className={t2} />
              <EmojiPicker
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onEmojiSelect={handleEmojiSelect}
                darkMode={darkMode}
              />
            </button>
            <button
              onClick={handleSend}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${accBg}`}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
