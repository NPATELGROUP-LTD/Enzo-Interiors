import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  Folder,
  MessageCircle,
  FileText,
  Receipt,
  Settings,
  Bell,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useNotifications } from "../../hooks/useNotifications";
import { useScrollToTop } from "../../hooks/useScrollToTop";
import { MobileNav } from "../shared/MobileNav";

const dockItems = [
  { Icon: Home, label: "Dashboard", path: "/portal/dashboard" },
  { Icon: Folder, label: "Projects", path: "/portal/projects" },
  { Icon: MessageCircle, label: "Messages", path: "/portal/messages" },
  { Icon: FileText, label: "Documents", path: "/portal/documents" },
  { Icon: Receipt, label: "Invoices", path: "/portal/invoices" },
  { Icon: Settings, label: "Settings", path: "/portal/settings" },
];

export function PortalLayout() {
  useScrollToTop();
  const [darkMode, toggleDarkMode] = useDarkMode(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const isMessages = location.pathname === "/portal/messages";

  const { notifications, markRead, markAllRead, unreadCount } =
    useNotifications([
      {
        type: "design",
        text: "New design renders uploaded",
        time: "2h ago",
        read: false,
      },
      {
        type: "appointment",
        text: "Your next appointment is March 8",
        time: "1d ago",
        read: true,
      },
      {
        type: "message",
        text: "Message from your designer",
        time: "2d ago",
        read: true,
      },
    ]);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div
        className={`min-h-screen transition-colors duration-500 ${darkMode ? "bg-[#111110]" : "bg-[#F5F4F0]"}`}
      >
        {/* Main Content */}
        <div
          className={`${isMessages ? "pt-0 pb-0 px-0" : "pt-6 pb-28 px-4 md:px-8 max-w-6xl mx-auto"}`}
        >
          <Outlet context={{ darkMode, toggleDarkMode }} />
        </div>

        {/* Bottom Dock */}
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 ${isMessages ? "hidden" : "hidden md:block"}`}
        >
          <div
            className={`px-3 py-3 rounded-full flex items-center justify-between gap-1 backdrop-blur-xl ${
              darkMode
                ? "bg-[#1E1E1C]/70 border border-[#2A2A28]"
                : "bg-white/60 border border-[#C4B8A8]/30"
            } shadow-[0_8px_32px_rgba(0,0,0,0.12)]`}
          >
            {/* Left: Profile & Theme */}
            <div className="flex items-center gap-1">
              <Link to="/portal/dashboard" className="relative group">
                <motion.div
                  className={`w-10 h-10 rounded-full ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"} flex items-center justify-center text-white text-[11px] hover:opacity-80`}
                  whileHover={{ scale: 1.1, y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  ST
                </motion.div>
                <div
                  className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${darkMode ? "bg-[#2A2A28] text-[#F0EEE9]" : "bg-[#1C4A3A] text-white"}`}
                >
                  Profile
                </div>
              </Link>
              <button onClick={toggleDarkMode} className="relative group">
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F2F0EB]"}`}
                  whileHover={{ scale: 1.1, y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  {darkMode ? (
                    <Sun size={18} className="text-[#F0EEE9]/50" />
                  ) : (
                    <Moon size={18} className="text-[#6B6B65]" />
                  )}
                </motion.div>
                <div
                  className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${darkMode ? "bg-[#2A2A28] text-[#F0EEE9]" : "bg-[#1C4A3A] text-white"}`}
                >
                  Theme
                </div>
              </button>
              <div
                className={`w-px h-6 ${darkMode ? "bg-[#2A2A28]" : "bg-[#C4B8A8]/40"}`}
              />
            </div>

            {/* Center: Navigation Icons */}
            <div className="flex items-center gap-1">
              {dockItems.map(({ Icon, label, path }) => {
                const isActive = location.pathname === path;
                return (
                  <Link key={path} to={path} className="relative group">
                    <motion.div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 ${
                        isActive
                          ? darkMode
                            ? "bg-[#4A8C5C]/20"
                            : "bg-[#1C4A3A]/10"
                          : darkMode
                            ? "hover:bg-[#2A2A28]"
                            : "hover:bg-[#F2F0EB]"
                      }`}
                      whileHover={{ scale: 1.1, y: -4 }}
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
                        className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                          darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"
                        }`}
                      />
                    )}
                    {/* Tooltip */}
                    <div
                      className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
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

            {/* Right: Notifications & Logout */}
            <div className="flex items-center gap-1">
              <div
                className={`w-px h-6 ${darkMode ? "bg-[#2A2A28]" : "bg-[#C4B8A8]/40"}`}
              />
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative group"
                >
                  <motion.div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F2F0EB]"}`}
                    whileHover={{ scale: 1.1, y: -4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
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
                    className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${darkMode ? "bg-[#2A2A28] text-[#F0EEE9]" : "bg-[#1C4A3A] text-white"}`}
                  >
                    Notifications
                  </div>
                </button>
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className={`absolute right-0 bottom-12 w-80 rounded-2xl shadow-2xl overflow-hidden z-50 ${darkMode ? "bg-[#1C1C1A] border border-[#2A2A28]" : "bg-white border border-[#C4B8A8]/20"}`}
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
                            toast.success("All notifications marked as read");
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
                          className={`px-4 py-3 flex items-start gap-3 ${!n.read ? (darkMode ? "bg-[#4A8C5C]/5" : "bg-[#1C4A3A]/5") : ""} ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"} cursor-pointer transition-colors`}
                        >
                          {!n.read && (
                            <div
                              className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                            />
                          )}
                          <div
                            className={!n.read ? "" : "pl-[calc(0.5rem+2px)]"}
                          >
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
                  className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500/10`}
                  whileHover={{ scale: 1.1, y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <LogOut size={18} className="text-red-500" />
                </motion.div>
                <div
                  className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-red-500 text-white`}
                >
                  Logout
                </div>
              </Link>
            </div>
          </div>

          <Toaster position="bottom-right" />
        </div>

        {/* Mobile Navigation */}
        <MobileNav
          darkMode={darkMode}
          isPortal={true}
          onLogout={() => {
            localStorage.removeItem("enzo_auth");
            window.location.href = "/portal/login";
          }}
          toggleTheme={toggleDarkMode}
        />

        {showNotifications && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowNotifications(false)}
          />
        )}
      </div>
    </div>
  );
}
