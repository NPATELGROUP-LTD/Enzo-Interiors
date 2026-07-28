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
  LayoutDashboard,
  Users,
  CalendarDays,
  FolderKanban,
  Receipt,
  MessageCircle,
  Inbox,
  Globe,
  Award,
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

const conversations = [
  {
    id: 1,
    name: "Sarah Thompson",
    avatar: "ST",
    lastMsg: "Thanks for the updated renders!",
    time: "2h",
    unread: 1,
    online: true,
    project: "Bedroom Renovation",
  },
  {
    id: 2,
    name: "James Mitchell",
    avatar: "JM",
    lastMsg: "When can we schedule the install?",
    time: "5h",
    unread: 2,
    online: false,
    project: "Kitchen Redesign",
  },
  {
    id: 3,
    name: "Emma Richardson",
    avatar: "ER",
    lastMsg: "Love the media wall design!",
    time: "1d",
    unread: 0,
    online: true,
    project: "Media Wall Install",
  },
  {
    id: 4,
    name: "David Chen",
    avatar: "DC",
    lastMsg: "Could we change the wardrobe finish?",
    time: "2d",
    unread: 1,
    online: false,
    project: "Walk-in Wardrobe",
  },
  {
    id: 5,
    name: "Priya Patel",
    avatar: "PP",
    lastMsg: "The sage green samples are perfect",
    time: "3d",
    unread: 0,
    online: false,
    project: "Sage Green Kitchen",
  },
  {
    id: 6,
    name: "Tom Bailey",
    avatar: "TB",
    lastMsg: "Can we add extra shelving?",
    time: "4d",
    unread: 0,
    online: false,
    project: "Media Wall + Storage",
  },
  {
    id: 7,
    name: "Rachel Adams",
    avatar: "RA",
    lastMsg: "Everything looks amazing!",
    time: "1w",
    unread: 0,
    online: false,
    project: "Full Home Renovation",
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
      from: "client",
      text: "Hi! I was wondering if you could share the updated 3D renders for the bedroom?",
      time: "9:30am",
      read: true,
    },
    {
      id: 2,
      from: "admin",
      text: "Hi Sarah! Of course. I've just uploaded the latest version to your Documents section. You should be able to see the wardrobe layout changes we discussed.",
      time: "10:15am",
      read: true,
    },
    {
      id: 3,
      from: "client",
      text: "That's brilliant, thank you! The wardrobe looks exactly how I imagined it.",
      time: "10:45am",
      read: true,
    },
    {
      id: 4,
      from: "admin",
      text: "Great to hear! We're really happy with how it's coming together. Shall we proceed with the current design or would you like any more changes?",
      time: "11:00am",
      read: true,
    },
    {
      id: 5,
      from: "client",
      text: "I think we're ready to proceed! Thanks for the updated renders!",
      time: "11:30am",
      read: true,
    },
  ],
  2: [
    {
      id: 1,
      from: "client",
      text: "Hi there, when can we schedule the kitchen installation?",
      time: "Yesterday",
      read: true,
    },
    {
      id: 2,
      from: "admin",
      text: "Hi James! We're looking at the week of March 15th. Would that work for you?",
      time: "Yesterday",
      read: true,
    },
    {
      id: 3,
      from: "client",
      text: "That works perfectly. When can we schedule the install?",
      time: "5h ago",
      read: false,
    },
  ],
};

const dockItems = [
  { Icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
  { Icon: Users, label: "Clients", path: "/admin/clients" },
  { Icon: CalendarDays, label: "Bookings", path: "/admin/bookings" },
  { Icon: FolderKanban, label: "Projects", path: "/admin/projects" },
  { Icon: Receipt, label: "Invoices", path: "/admin/invoices" },
  { Icon: MessageCircle, label: "Messages", path: "/admin/messages" },
  { Icon: Inbox, label: "Enquiries", path: "/admin/contact-submissions" },
  { Icon: Globe, label: "Content", path: "/admin/content" },
  { Icon: Award, label: "Testimonials", path: "/admin/testimonials" },
  { Icon: Settings, label: "Settings", path: "/admin/settings" },
];

export function AdminMessages() {
  usePageTitle("Messages - Admin Portal");
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
        type: "enquiry",
        text: "New enquiry from Alex Morrison",
        time: "10 min ago",
        read: false,
      },
      {
        type: "design",
        text: "Sarah Thompson approved the design",
        time: "1 hour ago",
        read: false,
      },
      {
        type: "invoice",
        text: "Invoice INV-003 is overdue",
        time: "3 hours ago",
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
      from: "admin",
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
            Messages
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
            {/* First row: Navigation Icons (10 items in 2 rows of 5) */}
            <div className="grid grid-cols-5 gap-1">
              {dockItems.map(({ Icon, label, path }) => {
                const isActive =
                  location.pathname === path ||
                  (path === "/admin/dashboard" &&
                    location.pathname === "/admin");
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

            {/* Second row: Profile, Theme, Bell, Logout in single row */}
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <Link to="/admin/dashboard" className="relative group">
                  <motion.div
                    className={`w-10 h-10 rounded-full bg-[#1C4A3A] flex items-center justify-center text-white text-[11px] ${
                      darkMode ? "hover:bg-[#4A8C5C]" : "hover:bg-[#1C4A3A]/80"
                    }`}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    OK
                  </motion.div>
                  <div
                    className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                      darkMode
                        ? "bg-[#2A2A28] text-[#F0EEE9]"
                        : "bg-[#1C4A3A] text-white"
                    }`}
                  >
                    Profile
                  </div>
                </Link>
                <button onClick={toggleDarkMode} className="relative group">
                  <motion.div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F2F0EB]"
                    }`}
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
                    className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                      darkMode
                        ? "bg-[#2A2A28] text-[#F0EEE9]"
                        : "bg-[#1C4A3A] text-white"
                    }`}
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
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F2F0EB]"
                      }`}
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
                    <div
                      className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                        darkMode
                          ? "bg-[#2A2A28] text-[#F0EEE9]"
                          : "bg-[#1C4A3A] text-white"
                      }`}
                    >
                      Notifications
                    </div>
                  </button>
                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className={`absolute right-0 bottom-12 w-80 rounded-2xl shadow-2xl overflow-hidden z-50 ${
                          darkMode
                            ? "bg-[#1C1C1A] border border-[#2A2A28]"
                            : "bg-white border border-[#C4B8A8]/20"
                        }`}
                      >
                        <div
                          className={`px-4 py-3 flex items-center justify-between border-b ${
                            darkMode
                              ? "border-[#2A2A28]"
                              : "border-[#C4B8A8]/20"
                          }`}
                        >
                          <span
                            className={`text-[13px] ${
                              darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]"
                            }`}
                            style={{ fontWeight: 500 }}
                          >
                            Notifications
                          </span>
                          <button
                            onClick={() => {
                              markAllRead();
                              toast.success("All notifications marked as read");
                            }}
                            className={`text-[11px] ${
                              darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]"
                            }`}
                          >
                            Mark all read
                          </button>
                        </div>
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => markRead(n.id)}
                            className={`px-4 py-3 flex items-start gap-3 ${
                              !n.read
                                ? darkMode
                                  ? "bg-[#4A8C5C]/5"
                                  : "bg-[#1C4A3A]/5"
                                : ""
                            } ${
                              darkMode
                                ? "hover:bg-[#2A2A28]"
                                : "hover:bg-[#F5F4F0]"
                            } transition-colors cursor-pointer`}
                          >
                            {!n.read && (
                              <div
                                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                  darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"
                                }`}
                              />
                            )}
                            <div>
                              <p
                                className={`text-[12px] ${
                                  darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]"
                                }`}
                              >
                                {n.text}
                              </p>
                              <p
                                className={`text-[10px] ${
                                  darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]"
                                } mt-0.5`}
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
                    className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500/10`}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    <LogOut size={18} className="text-red-500" />
                  </motion.div>
                  <div
                    className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-red-500 text-white`}
                  >
                    Logout
                  </div>
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
              className={`flex ${msg.from === "admin" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[65%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${msg.from === "admin" ? `${accBg} text-white` : darkMode ? "bg-[#1C1C1A] text-[#F0EEE9] border border-[#2A2A28]" : "bg-white text-[#2C2C2C] border border-[#C4B8A8]/20"}`}
              >
                {msg.text}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 ${msg.from === "admin" ? "text-white/50" : t2}`}
                >
                  <span className="text-[10px]">{msg.time}</span>
                  {msg.from === "admin" &&
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
                const file = e.target.files?.[0];
                if (file) {
                  toast.success(`Attached: ${file.name}`);
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
                const file = e.target.files?.[0];
                if (file) {
                  toast.success(`Image attached: ${file.name}`);
                  e.target.value = "";
                }
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-2 rounded-xl ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
              title="Attach file"
            >
              <Paperclip size={18} className={t2} />
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className={`p-2 rounded-xl ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
              title="Attach image"
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
