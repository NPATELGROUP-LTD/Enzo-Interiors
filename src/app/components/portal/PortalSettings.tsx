import { useState } from "react";
import { useOutletContext } from "react-router";
import { motion } from "motion/react";
import { User, Bell, Shield, Palette } from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

const settingsSections = [
  { id: "profile", label: "Profile", Icon: User },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "security", label: "Security", Icon: Shield },
  { id: "preferences", label: "Preferences", Icon: Palette },
];

export function PortalSettings() {
  usePageTitle("Settings - Client Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [activeSection, setActiveSection] = useState("profile");
  const [notifSettings, setNotifSettings] = useState({
    emailNewMessage: true,
    emailAppointmentReminder: true,
    emailInvoiceDue: true,
    emailDesignUploaded: true,
    smsAppointmentReminder: false,
    smsInvoiceDue: false,
    smsDesignAlert: false,
    inAppNewMessage: true,
    inAppProjectUpdate: true,
    inAppInvoice: true,
    inAppAppointment: true,
  });

  const cardBg = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const textPrimary = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const textSecondary = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const accent = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const accBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";
  const inputBg = darkMode
    ? "bg-[#2A2A28] border-[#2A2A28]"
    : "bg-[#F5F4F0] border-[#C4B8A8]";

  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <button
      onClick={onChange}
      className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${checked ? accBg : darkMode ? "bg-[#2A2A28]" : "bg-[#C4B8A8]"}`}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: checked ? "22px" : "2px" }}
      />
    </button>
  );

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${textPrimary} mb-8`}
        style={{ fontSize: "1.8rem" }}
      >
        Settings
      </motion.h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="md:w-56 flex-shrink-0">
          <div className={`${cardBg} border rounded-2xl p-3`}>
            {settingsSections.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] transition-colors ${
                  activeSection === id
                    ? darkMode
                      ? "bg-[#4A8C5C]/10 text-[#4A8C5C]"
                      : "bg-[#1C4A3A]/10 text-[#1C4A3A]"
                    : `${textSecondary} ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className={`${cardBg} border rounded-2xl p-6 md:p-8`}>
            {activeSection === "profile" && (
              <div className="space-y-6">
                <h3 className={textPrimary} style={{ fontSize: "1.2rem" }}>
                  Profile Information
                </h3>
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-[18px] text-white ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                  >
                    ST
                  </div>
                  <button
                    className={`px-4 py-1.5 rounded-full text-[12px] border ${darkMode ? "border-[#2A2A28] text-[#8A8A82]" : "border-[#C4B8A8] text-[#6B6B65]"}`}
                    onClick={() => toast.success("Photo upload initiated")}
                  >
                    Upload Photo
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`text-[12px] ${textSecondary} block mb-1`}
                    >
                      Full Name
                    </label>
                    <input
                      defaultValue="Sarah Thompson"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inputBg} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <label
                      className={`text-[12px] ${textSecondary} block mb-1`}
                    >
                      Email
                    </label>
                    <input
                      defaultValue="sarah@email.com"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inputBg} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <label
                      className={`text-[12px] ${textSecondary} block mb-1`}
                    >
                      Phone
                    </label>
                    <input
                      defaultValue="07XXX XXXXXX"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inputBg} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <label
                      className={`text-[12px] ${textSecondary} block mb-1`}
                    >
                      Address
                    </label>
                    <input
                      defaultValue="Oadby, Leicester"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inputBg} ${textPrimary}`}
                    />
                  </div>
                </div>
                <button
                  onClick={() => toast.success("Profile updated!")}
                  className={`px-6 py-2.5 rounded-full text-[13px] ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"}`}
                >
                  Save Changes
                </button>
              </div>
            )}

            {activeSection === "notifications" && (
              <div className="space-y-6">
                <h3 className={textPrimary} style={{ fontSize: "1.2rem" }}>
                  Notification Preferences
                </h3>
                <div>
                  <h4
                    className={`text-[14px] ${textPrimary} mb-3`}
                    style={{ fontWeight: 500 }}
                  >
                    Email Notifications
                  </h4>
                  {[
                    {
                      key: "emailNewMessage" as const,
                      label: "New messages",
                      desc: "When the Enzo team sends you a message",
                    },
                    {
                      key: "emailAppointmentReminder" as const,
                      label: "Appointment reminders",
                      desc: "24 hours before your scheduled consultation",
                    },
                    {
                      key: "emailInvoiceDue" as const,
                      label: "Invoice due",
                      desc: "When an invoice is approaching its due date",
                    },
                    {
                      key: "emailDesignUploaded" as const,
                      label: "Design uploaded",
                      desc: "When new designs are ready for your review",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between py-3 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                    >
                      <div>
                        <p className={`text-[13px] ${textPrimary}`}>
                          {item.label}
                        </p>
                        <p className={`text-[11px] ${textSecondary}`}>
                          {item.desc}
                        </p>
                      </div>
                      <Toggle
                        checked={notifSettings[item.key]}
                        onChange={() =>
                          setNotifSettings({
                            ...notifSettings,
                            [item.key]: !notifSettings[item.key],
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <h4
                    className={`text-[14px] ${textPrimary} mb-3`}
                    style={{ fontWeight: 500 }}
                  >
                    SMS Notifications
                  </h4>
                  {[
                    {
                      key: "smsAppointmentReminder" as const,
                      label: "Appointment reminder SMS",
                      desc: "Text reminder before your appointment",
                    },
                    {
                      key: "smsInvoiceDue" as const,
                      label: "Invoice due reminder",
                      desc: "Text when payment is due",
                    },
                    {
                      key: "smsDesignAlert" as const,
                      label: "Design ready alert",
                      desc: "Text when new designs are available",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between py-3 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                    >
                      <div>
                        <p className={`text-[13px] ${textPrimary}`}>
                          {item.label}
                        </p>
                        <p className={`text-[11px] ${textSecondary}`}>
                          {item.desc}
                        </p>
                      </div>
                      <Toggle
                        checked={notifSettings[item.key]}
                        onChange={() =>
                          setNotifSettings({
                            ...notifSettings,
                            [item.key]: !notifSettings[item.key],
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <h4
                    className={`text-[14px] ${textPrimary} mb-3`}
                    style={{ fontWeight: 500 }}
                  >
                    In-App Notifications
                  </h4>
                  {[
                    {
                      key: "inAppNewMessage" as const,
                      label: "New messages",
                      desc: "Show in-app badge for unread messages",
                    },
                    {
                      key: "inAppProjectUpdate" as const,
                      label: "Project updates",
                      desc: "Notify when project status changes",
                    },
                    {
                      key: "inAppInvoice" as const,
                      label: "Invoice activity",
                      desc: "Notify for new or overdue invoices",
                    },
                    {
                      key: "inAppAppointment" as const,
                      label: "Appointment changes",
                      desc: "Notify for booking confirmations or changes",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between py-3 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                    >
                      <div>
                        <p className={`text-[13px] ${textPrimary}`}>
                          {item.label}
                        </p>
                        <p className={`text-[11px] ${textSecondary}`}>
                          {item.desc}
                        </p>
                      </div>
                      <Toggle
                        checked={notifSettings[item.key]}
                        onChange={() =>
                          setNotifSettings({
                            ...notifSettings,
                            [item.key]: !notifSettings[item.key],
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    toast.success("Notification preferences saved!")
                  }
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Notification Preferences
                </button>
              </div>
            )}

            {activeSection === "security" && (
              <div className="space-y-6">
                <h3 className={textPrimary} style={{ fontSize: "1.2rem" }}>
                  Security
                </h3>
                <div>
                  <h4 className={`text-[14px] ${textPrimary} mb-4`}>
                    Change Password
                  </h4>
                  <div className="space-y-3 max-w-sm">
                    <input
                      type="password"
                      placeholder="Current password"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inputBg} ${textPrimary}`}
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inputBg} ${textPrimary}`}
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inputBg} ${textPrimary}`}
                    />
                    <button
                      onClick={() => toast.success("Password updated!")}
                      className={`px-6 py-2.5 rounded-full text-[13px] ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"}`}
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "preferences" && (
              <div className="space-y-6">
                <h3 className={textPrimary} style={{ fontSize: "1.2rem" }}>
                  Preferences
                </h3>
                <div
                  className={`flex items-center justify-between py-3 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                >
                  <div>
                    <p className={`text-[13px] ${textPrimary}`}>Dark Mode</p>
                    <p className={`text-[12px] ${textSecondary}`}>
                      Toggle between light and dark themes
                    </p>
                  </div>
                  <span className={`text-[12px] ${textSecondary}`}>
                    Use the toggle in the top bar
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
