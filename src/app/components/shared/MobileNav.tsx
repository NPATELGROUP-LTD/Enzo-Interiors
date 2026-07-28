import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  Home,
  FolderOpen,
  MessageSquare,
  FileText,
  MoreHorizontal,
  Settings,
  User,
  LogOut,
} from "lucide-react";
import { BottomSheet } from "./BottomSheet";

interface MobileNavProps {
  darkMode: boolean;
  isPortal: boolean;
  onLogout: () => void;
  toggleTheme: () => void;
}

export function MobileNav({
  darkMode,
  isPortal,
  onLogout,
  toggleTheme,
}: MobileNavProps) {
  const location = useLocation();
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const primaryNav = isPortal
    ? [
        { path: "/portal/dashboard", icon: Home, label: "Dashboard" },
        { path: "/portal/projects", icon: FolderOpen, label: "Projects" },
        { path: "/portal/messages", icon: MessageSquare, label: "Messages" },
        { path: "/portal/invoices", icon: FileText, label: "Invoices" },
      ]
    : [
        { path: "/admin/dashboard", icon: Home, label: "Dashboard" },
        { path: "/admin/clients", icon: User, label: "Clients" },
        { path: "/admin/projects", icon: FolderOpen, label: "Projects" },
        { path: "/admin/messages", icon: MessageSquare, label: "Messages" },
      ];

  const moreItems = isPortal
    ? [
        { path: "/portal/documents", label: "Documents" },
        { path: "/portal/settings", label: "Settings" },
      ]
    : [
        { path: "/admin/bookings", label: "Bookings" },
        { path: "/admin/invoices", label: "Invoices" },
        { path: "/admin/enquiries", label: "Contact Enquiries" },
        { path: "/admin/content", label: "Content Manager" },
        { path: "/admin/testimonials", label: "Testimonials" },
        { path: "/admin/settings", label: "Settings" },
      ];

  const bg = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const activeColor = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const inactiveColor = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";

  return (
    <>
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 ${bg} border-t backdrop-blur-xl z-50`}
      >
        <div className="flex items-center justify-around px-2 py-3">
          {primaryNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                isActive(item.path)
                  ? `${activeColor} ${darkMode ? "bg-[#4A8C5C]/10" : "bg-[#1C4A3A]/5"}`
                  : `${inactiveColor} hover:${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`
              }`}
            >
              <item.icon size={20} />
              <span className="text-[9px]">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setShowMoreSheet(true)}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${inactiveColor} hover:${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
          >
            <MoreHorizontal size={20} />
            <span className="text-[9px]">More</span>
          </button>
        </div>
      </div>

      <BottomSheet
        open={showMoreSheet}
        onClose={() => setShowMoreSheet(false)}
        darkMode={darkMode}
        title="More Options"
      >
        <div className="space-y-1">
          {moreItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setShowMoreSheet(false)}
              className={`block px-4 py-3 rounded-lg transition-colors ${
                isActive(item.path)
                  ? `${activeColor} ${darkMode ? "bg-[#4A8C5C]/10" : "bg-[#1C4A3A]/5"}`
                  : `${darkMode ? "text-[#F0EEE9] hover:bg-[#2A2A28]" : "text-[#1E1E1C] hover:bg-[#F5F4F0]"}`
              }`}
            >
              {item.label}
            </Link>
          ))}
          <hr
            className={`my-2 ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
          />
          <button
            onClick={toggleTheme}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${darkMode ? "text-[#F0EEE9] hover:bg-[#2A2A28]" : "text-[#1E1E1C] hover:bg-[#F5F4F0]"}`}
          >
            Toggle {darkMode ? "Light" : "Dark"} Mode
          </button>
          <button
            onClick={() => {
              setShowMoreSheet(false);
              onLogout();
            }}
            className="w-full text-left px-4 py-3 rounded-lg transition-colors text-red-500 hover:bg-red-500/10"
          >
            Logout
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
