import { useState } from "react";
import { useOutletContext } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2,
  CalendarDays,
  Bell,
  Users,
  Shield,
  Globe,
  X,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

const settingsSections = [
  { id: "business", label: "Business Profile", Icon: Building2 },
  { id: "booking", label: "Booking Settings", Icon: CalendarDays },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "team", label: "Team & Roles", Icon: Users },
  { id: "website", label: "Website Settings", Icon: Globe },
  { id: "audit", label: "Audit Log", Icon: Shield },
];

const auditLog = [
  {
    time: "Today, 10:30am",
    actor: "Oyz Khan",
    role: "Super Admin",
    action: "Updated project status to 'Design'",
    record: "Sarah Thompson - Bedroom",
  },
  {
    time: "Today, 9:15am",
    actor: "Oyz Khan",
    role: "Super Admin",
    action: "Created invoice INV-005",
    record: "David Chen - Wardrobe",
  },
  {
    time: "Yesterday, 4:00pm",
    actor: "Oyz Khan",
    role: "Super Admin",
    action: "Added new client",
    record: "Tom Bailey",
  },
  {
    time: "Yesterday, 2:30pm",
    actor: "Design Team",
    role: "Project Manager",
    action: "Uploaded mood board",
    record: "Priya Patel - Kitchen",
  },
  {
    time: "2 days ago",
    actor: "Oyz Khan",
    role: "Super Admin",
    action: "Confirmed booking",
    record: "James Mitchell",
  },
  {
    time: "3 days ago",
    actor: "Installation Team",
    role: "Installer",
    action: "Updated installation status",
    record: "Emma Richardson - Media Wall",
  },
];

const roles = [
  {
    id: "super-admin",
    name: "Super Admin",
    desc: "Full access to everything",
    permissions: ["All"],
    color: "text-red-400",
  },
  {
    id: "project-manager",
    name: "Project Manager",
    desc: "Manage assigned clients and projects",
    permissions: [
      "View clients",
      "Edit projects",
      "Messages",
      "Upload files",
      "View bookings",
    ],
    color: "text-blue-400",
  },
  {
    id: "installer",
    name: "Installer",
    desc: "View assigned installations",
    permissions: [
      "View assigned projects",
      "Update installation status",
      "Messages",
    ],
    color: "text-amber-400",
  },
  {
    id: "designer",
    name: "Designer",
    desc: "Design and upload work",
    permissions: [
      "View projects",
      "Upload designs",
      "Messages",
      "View client briefs",
    ],
    color: "text-purple-400",
  },
];

export function AdminSettings() {
  usePageTitle("Settings - Admin Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [section, setSection] = useState("business");
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "project-manager",
  });
  const [teamMembers, setTeamMembers] = useState([
    {
      id: 1,
      name: "Oyz Khan",
      email: "oyz@enzointeriors.co.uk",
      role: "Super Admin",
      lastLogin: "2 min ago",
      active: true,
      assignedClients: ["Sarah Thompson", "Emma Richardson", "Rachel Adams"],
    },
    {
      id: 2,
      name: "Amir Hassan",
      email: "amir@enzointeriors.co.uk",
      role: "Project Manager",
      lastLogin: "1 hour ago",
      active: true,
      assignedClients: ["James Mitchell", "David Chen"],
    },
    {
      id: 3,
      name: "Design Team",
      email: "design@enzointeriors.co.uk",
      role: "Designer",
      lastLogin: "3 hours ago",
      active: true,
      assignedClients: ["Priya Patel", "Tom Bailey"],
    },
    {
      id: 4,
      name: "Install Crew",
      email: "install@enzointeriors.co.uk",
      role: "Installer",
      lastLogin: "1 day ago",
      active: false,
      assignedClients: [],
    },
  ]);

  const [bookingSettings, setBookingSettings] = useState({
    slotDuration: "60",
    maxPerDay: "4",
    bufferTime: "30",
    autoConfirm: false,
    requirePhone: true,
    showAvailability: true,
    days: {
      Monday: { enabled: true, start: "09:00", end: "17:00" },
      Tuesday: { enabled: true, start: "09:00", end: "17:00" },
      Wednesday: { enabled: true, start: "09:00", end: "17:00" },
      Thursday: { enabled: true, start: "09:00", end: "17:00" },
      Friday: { enabled: true, start: "09:00", end: "17:00" },
      Saturday: { enabled: false, start: "10:00", end: "14:00" },
      Sunday: { enabled: false, start: "", end: "" },
    } as Record<string, { enabled: boolean; start: string; end: string }>,
  });

  const [notifSettings, setNotifSettings] = useState({
    emailNewBooking: true,
    emailCancellation: true,
    emailNewEnquiry: true,
    emailInvoicePaid: true,
    smsNewBooking: false,
    smsCancellation: true,
    smsReminder: true,
    clientConfirmation: true,
    clientReminder24h: true,
    clientFollowUp: true,
    clientInvoice: true,
  });

  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const acc = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const accBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";
  const inp = darkMode
    ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]"
    : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]";

  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <button
      onClick={onChange}
      className={`w-10 h-5 rounded-full relative transition-colors ${checked ? accBg : darkMode ? "bg-[#2A2A28]" : "bg-[#C4B8A8]"}`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "left-5.5 translate-x-0" : "left-0.5"}`}
        style={{ left: checked ? "22px" : "2px" }}
      />
    </button>
  );

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setTeamMembers([
      ...teamMembers,
      {
        id: Date.now(),
        name: inviteForm.name,
        email: inviteForm.email,
        role:
          roles.find((r) => r.id === inviteForm.role)?.name ||
          "Project Manager",
        lastLogin: "Never",
        active: false,
        assignedClients: [],
      },
    ]);
    toast.success(`Invitation sent to ${inviteForm.email}`);
    setInviteModal(false);
    setInviteForm({ name: "", email: "", role: "project-manager" });
  };

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${t1} mb-8`}
        style={{ fontSize: "1.8rem" }}
      >
        Settings
      </motion.h1>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-56 flex-shrink-0">
          <div className={`${c} border rounded-2xl p-3`}>
            {settingsSections.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] transition-colors ${section === id ? (darkMode ? "bg-[#4A8C5C]/10 text-[#4A8C5C]" : "bg-[#1C4A3A]/10 text-[#1C4A3A]") : `${t2} ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className={`${c} border rounded-2xl p-6 md:p-8`}>
            {section === "business" && (
              <div className="space-y-5">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Business Profile
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ["Company Name", "Enzo Interiors"],
                    ["Phone", "0116 XXX XXXX"],
                    ["Email", "hello@enzointeriors.co.uk"],
                    ["Website", "www.enzointeriors.co.uk"],
                    ["Address", "Leicester, UK"],
                    ["Registration", "Company No. XXXXXXXX"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        {label}
                      </label>
                      <input
                        defaultValue={val}
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Business Description
                  </label>
                  <textarea
                    rows={3}
                    defaultValue="Bespoke fitted furniture specialists based in Leicester. Kitchens, bedrooms, media walls, and wardrobes."
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none resize-none ${inp}`}
                  />
                </div>
                <button
                  onClick={() => toast.success("Settings saved!")}
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Changes
                </button>
              </div>
            )}

            {section === "booking" && (
              <div className="space-y-6">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Booking Settings
                </h3>
                <div>
                  <h4
                    className={`text-[14px] ${t1} mb-4`}
                    style={{ fontWeight: 500 }}
                  >
                    Availability Schedule
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(bookingSettings.days).map(
                      ([day, config]) => (
                        <div
                          key={day}
                          className={`flex items-center gap-4 p-3 rounded-xl ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
                        >
                          <Toggle
                            checked={config.enabled}
                            onChange={() =>
                              setBookingSettings({
                                ...bookingSettings,
                                days: {
                                  ...bookingSettings.days,
                                  [day]: {
                                    ...config,
                                    enabled: !config.enabled,
                                  },
                                },
                              })
                            }
                          />
                          <span
                            className={`text-[13px] w-24 ${config.enabled ? t1 : t2}`}
                          >
                            {day}
                          </span>
                          {config.enabled ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={config.start}
                                onChange={(e) =>
                                  setBookingSettings({
                                    ...bookingSettings,
                                    days: {
                                      ...bookingSettings.days,
                                      [day]: {
                                        ...config,
                                        start: e.target.value,
                                      },
                                    },
                                  })
                                }
                                className={`px-2 py-1 rounded-lg border text-[12px] focus:outline-none ${inp}`}
                              />
                              <span className={t2}>to</span>
                              <input
                                type="time"
                                value={config.end}
                                onChange={(e) =>
                                  setBookingSettings({
                                    ...bookingSettings,
                                    days: {
                                      ...bookingSettings.days,
                                      [day]: { ...config, end: e.target.value },
                                    },
                                  })
                                }
                                className={`px-2 py-1 rounded-lg border text-[12px] focus:outline-none ${inp}`}
                              />
                            </div>
                          ) : (
                            <span className={`text-[12px] ${t2}`}>Closed</span>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Slot Duration (min)
                    </label>
                    <select
                      value={bookingSettings.slotDuration}
                      onChange={(e) =>
                        setBookingSettings({
                          ...bookingSettings,
                          slotDuration: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    >
                      <option>30</option>
                      <option>45</option>
                      <option>60</option>
                      <option>90</option>
                      <option>120</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Max Bookings/Day
                    </label>
                    <input
                      type="number"
                      value={bookingSettings.maxPerDay}
                      onChange={(e) =>
                        setBookingSettings({
                          ...bookingSettings,
                          maxPerDay: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Buffer Time (min)
                    </label>
                    <input
                      type="number"
                      value={bookingSettings.bufferTime}
                      onChange={(e) =>
                        setBookingSettings({
                          ...bookingSettings,
                          bufferTime: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      key: "autoConfirm" as const,
                      label: "Auto-confirm bookings",
                      desc: "Automatically confirm new booking requests",
                    },
                    {
                      key: "requirePhone" as const,
                      label: "Require phone number",
                      desc: "Make phone number mandatory for bookings",
                    },
                    {
                      key: "showAvailability" as const,
                      label: "Show public availability",
                      desc: "Display available slots on the booking page",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between py-3 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                    >
                      <div>
                        <p className={`text-[13px] ${t1}`}>{item.label}</p>
                        <p className={`text-[11px] ${t2}`}>{item.desc}</p>
                      </div>
                      <Toggle
                        checked={bookingSettings[item.key]}
                        onChange={() =>
                          setBookingSettings({
                            ...bookingSettings,
                            [item.key]: !bookingSettings[item.key],
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => toast.success("Booking settings saved!")}
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Booking Settings
                </button>
              </div>
            )}

            {section === "notifications" && (
              <div className="space-y-6">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Notification Settings
                </h3>
                <div>
                  <h4
                    className={`text-[14px] ${t1} mb-3`}
                    style={{ fontWeight: 500 }}
                  >
                    Admin Email Notifications
                  </h4>
                  {[
                    {
                      key: "emailNewBooking" as const,
                      label: "New booking received",
                      desc: "When a client books a consultation",
                    },
                    {
                      key: "emailCancellation" as const,
                      label: "Booking cancelled",
                      desc: "When a client cancels a booking",
                    },
                    {
                      key: "emailNewEnquiry" as const,
                      label: "New contact form enquiry",
                      desc: "When someone submits the contact form",
                    },
                    {
                      key: "emailInvoicePaid" as const,
                      label: "Invoice paid",
                      desc: "When a client pays an invoice",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between py-3 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                    >
                      <div>
                        <p className={`text-[13px] ${t1}`}>{item.label}</p>
                        <p className={`text-[11px] ${t2}`}>{item.desc}</p>
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
                    className={`text-[14px] ${t1} mb-3`}
                    style={{ fontWeight: 500 }}
                  >
                    Admin SMS Notifications
                  </h4>
                  {[
                    {
                      key: "smsNewBooking" as const,
                      label: "New booking SMS",
                      desc: "Receive SMS for new bookings",
                    },
                    {
                      key: "smsCancellation" as const,
                      label: "Cancellation SMS",
                      desc: "Receive SMS for cancellations",
                    },
                    {
                      key: "smsReminder" as const,
                      label: "Daily reminder",
                      desc: "Morning summary of today's bookings",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between py-3 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                    >
                      <div>
                        <p className={`text-[13px] ${t1}`}>{item.label}</p>
                        <p className={`text-[11px] ${t2}`}>{item.desc}</p>
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
                    className={`text-[14px] ${t1} mb-3`}
                    style={{ fontWeight: 500 }}
                  >
                    Client Notifications
                  </h4>
                  {[
                    {
                      key: "clientConfirmation" as const,
                      label: "Booking confirmation",
                      desc: "Send confirmation email to clients",
                    },
                    {
                      key: "clientReminder24h" as const,
                      label: "24h reminder",
                      desc: "Remind clients 24 hours before appointment",
                    },
                    {
                      key: "clientFollowUp" as const,
                      label: "Follow-up email",
                      desc: "Send follow-up after consultation",
                    },
                    {
                      key: "clientInvoice" as const,
                      label: "Invoice notifications",
                      desc: "Notify clients about new invoices",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between py-3 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                    >
                      <div>
                        <p className={`text-[13px] ${t1}`}>{item.label}</p>
                        <p className={`text-[11px] ${t2}`}>{item.desc}</p>
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
                  onClick={() => toast.success("Notification settings saved!")}
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Notification Settings
                </button>
              </div>
            )}

            {section === "team" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                    Team & Roles
                  </h3>
                  <button
                    onClick={() => setInviteModal(true)}
                    className={`px-4 py-2 rounded-full text-[12px] text-white flex items-center gap-1 ${accBg}`}
                  >
                    <Plus size={12} /> Invite Member
                  </button>
                </div>

                {/* Roles */}
                <div>
                  <h4
                    className={`text-[14px] ${t1} mb-3`}
                    style={{ fontWeight: 500 }}
                  >
                    Roles
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className={`p-4 rounded-xl border ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`text-[13px] ${t1}`}
                            style={{ fontWeight: 500 }}
                          >
                            {role.name}
                          </span>
                          <span className={`text-[10px] ${role.color}`}>
                            &bull;
                          </span>
                        </div>
                        <p className={`text-[11px] ${t2} mb-2`}>{role.desc}</p>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.map((p) => (
                            <span
                              key={p}
                              className={`px-2 py-0.5 rounded-full text-[9px] ${darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team Members */}
                <div>
                  <h4
                    className={`text-[14px] ${t1} mb-3`}
                    style={{ fontWeight: 500 }}
                  >
                    Team Members
                  </h4>
                  <div className="space-y-3">
                    {teamMembers.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-4 rounded-xl ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] text-white ${accBg}`}
                            >
                              {m.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </div>
                            {m.active && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                            )}
                          </div>
                          <div>
                            <p
                              className={`text-[13px] ${t1}`}
                              style={{ fontWeight: 500 }}
                            >
                              {m.name}
                            </p>
                            <p className={`text-[11px] ${t2}`}>{m.email}</p>
                            {m.assignedClients.length > 0 && (
                              <p className={`text-[10px] ${acc} mt-0.5`}>
                                {m.assignedClients.length} assigned client
                                {m.assignedClients.length > 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            defaultValue={m.role}
                            onChange={(e) =>
                              toast.success(
                                `${m.name}'s role changed to ${e.target.value}`,
                              )
                            }
                            className={`px-2 py-1 rounded-lg border text-[11px] focus:outline-none ${inp}`}
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <span
                            className={`text-[10px] ${t2} hidden sm:inline`}
                          >
                            {m.lastLogin}
                          </span>
                          {m.role !== "Super Admin" && (
                            <button
                              onClick={() => {
                                setTeamMembers(
                                  teamMembers.filter((x) => x.id !== m.id),
                                );
                                toast.success(`${m.name} removed`);
                              }}
                            >
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section === "website" && (
              <div className="space-y-5">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Website Settings
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Site Title
                    </label>
                    <input
                      defaultValue="Enzo Interiors | Bespoke Fitted Furniture"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Meta Description
                    </label>
                    <input
                      defaultValue="Luxury bespoke fitted furniture in Leicester"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    />
                  </div>
                </div>
                <div>
                  <h4
                    className={`text-[14px] ${t1} mb-3`}
                    style={{ fontWeight: 500 }}
                  >
                    Social Media Links
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      ["Instagram", "@enzo.interiors"],
                      ["Facebook", "enzointeriors"],
                      ["Pinterest", "enzointeriors"],
                      ["TikTok", "@enzo.interiors"],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <label className={`text-[12px] ${t2} block mb-1`}>
                          {label}
                        </label>
                        <input
                          defaultValue={val}
                          className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => toast.success("Website settings saved!")}
                  className={`px-6 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                >
                  Save Changes
                </button>
              </div>
            )}

            {section === "audit" && (
              <div className="space-y-5">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Audit Log
                </h3>
                <div className="space-y-3">
                  {auditLog.map((log, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-xl ${darkMode ? "hover:bg-[#2A2A28]/50" : "hover:bg-[#F5F4F0]"} transition-colors`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                      />
                      <div>
                        <p className={`text-[12px] ${t1}`}>
                          <span style={{ fontWeight: 500 }}>{log.actor}</span>{" "}
                          <span className={`text-[10px] ${t2}`}>
                            ({log.role})
                          </span>{" "}
                          {log.action}
                        </p>
                        <p className={`text-[11px] ${acc}`}>{log.record}</p>
                        <p className={`text-[10px] ${t2} mt-0.5`}>{log.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {inviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-md w-full p-6`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Invite Team Member
                </h3>
                <button onClick={() => setInviteModal(false)}>
                  <X size={18} className={t2} />
                </button>
              </div>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Full Name
                  </label>
                  <input
                    required
                    value={inviteForm.name}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, name: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  >
                    {roles
                      .filter((r) => r.id !== "super-admin")
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} — {r.desc}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className={`w-full py-3 rounded-full text-[14px] text-white ${accBg}`}
                >
                  Send Invitation
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
