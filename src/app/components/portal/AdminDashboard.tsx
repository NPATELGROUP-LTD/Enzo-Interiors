import { useState } from "react";
import { useOutletContext, Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  CalendarDays,
  FolderKanban,
  Receipt,
  MessageCircle,
  TrendingUp,
  ArrowUpRight,
  X,
  Plus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

const bookingsData = [
  { month: "Oct", bookings: 8 },
  { month: "Nov", bookings: 12 },
  { month: "Dec", bookings: 6 },
  { month: "Jan", bookings: 15 },
  { month: "Feb", bookings: 18 },
  { month: "Mar", bookings: 22 },
];

const todayBookings = [
  {
    name: "Sarah Thompson",
    time: "9:00am",
    service: "Bedroom",
    status: "Confirmed",
  },
  {
    name: "James Mitchell",
    time: "11:00am",
    service: "Kitchen",
    status: "Confirmed",
  },
  {
    name: "Emma Chen",
    time: "2:00pm",
    service: "Media Wall",
    status: "Pending",
  },
];

const recentMessages = [
  {
    client: "Sarah T.",
    msg: "Thanks for the updated renders!",
    time: "2h ago",
  },
  {
    client: "David C.",
    msg: "When can we schedule the install?",
    time: "5h ago",
  },
  { client: "Rachel A.", msg: "Love the colour samples!", time: "1d ago" },
];

type ModalType = "booking" | "client" | "invoice" | null;

export function AdminDashboard() {
  usePageTitle("Dashboard - Admin Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [bookingForm, setBookingForm] = useState({
    client: "",
    date: "",
    time: "",
    service: "Kitchen",
    notes: "",
  });
  const [clientForm, setClientForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    client: "",
    project: "",
    amount: "",
    dueDate: "",
    items: "",
  });

  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const acc = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const accBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";
  const inp = darkMode
    ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9] placeholder-[#8A8A82]"
    : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C] placeholder-[#C4B8A8]";

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Booking created successfully!");
    setActiveModal(null);
    setBookingForm({
      client: "",
      date: "",
      time: "",
      service: "Kitchen",
      notes: "",
    });
  };
  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Client added successfully!");
    setActiveModal(null);
    setClientForm({ name: "", email: "", phone: "", address: "" });
  };
  const handleInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Invoice created successfully!");
    setActiveModal(null);
    setInvoiceForm({
      client: "",
      project: "",
      amount: "",
      dueDate: "",
      items: "",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={t1}
          style={{ fontSize: "1.8rem" }}
        >
          Admin Dashboard
        </motion.h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveModal("booking")}
            className={`hidden sm:inline-flex px-4 py-2 rounded-full text-[12px] text-white items-center gap-1 ${accBg}`}
          >
            <Plus size={12} /> New Booking
          </button>
          <button
            onClick={() => setActiveModal("client")}
            className={`hidden sm:inline-flex px-4 py-2 rounded-full text-[12px] text-white items-center gap-1 ${accBg}`}
          >
            <Plus size={12} /> Add Client
          </button>
          <button
            onClick={() => setActiveModal("invoice")}
            className={`hidden sm:inline-flex px-4 py-2 rounded-full text-[12px] text-white items-center gap-1 ${accBg}`}
          >
            <Plus size={12} /> Issue Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Bookings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`${c} border rounded-2xl p-6 lg:col-span-2 lg:row-span-2`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className={`text-[11px] uppercase tracking-[0.2em] ${acc}`}>
              Today's Bookings
            </span>
            <span className={`text-[12px] ${t2}`}>March 1, 2026</span>
          </div>
          <div className="space-y-3 mt-4">
            {todayBookings.map((b) => (
              <div
                key={b.name}
                className={`flex items-center justify-between p-3 rounded-xl ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] text-white ${accBg}`}
                  >
                    {b.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p
                      className={`text-[13px] ${t1}`}
                      style={{ fontWeight: 500 }}
                    >
                      {b.name}
                    </p>
                    <p className={`text-[11px] ${t2}`}>
                      {b.time} &middot; {b.service}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] ${b.status === "Confirmed" ? (darkMode ? "bg-[#4A8C5C]/20 text-[#4A8C5C]" : "bg-[#1C4A3A]/10 text-[#1C4A3A]") : "bg-amber-500/10 text-amber-500"}`}
                  >
                    {b.status}
                  </span>
                  {b.status === "Pending" && (
                    <button
                      onClick={() =>
                        toast.success(`${b.name}'s booking confirmed!`)
                      }
                      className={`px-2 py-1 rounded-full text-[9px] text-white ${accBg}`}
                    >
                      Confirm
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/admin/bookings"
            className={`inline-block mt-4 text-[12px] ${acc} hover:underline`}
          >
            View all bookings &rarr;
          </Link>
        </motion.div>

        {/* Stats */}
        {[
          {
            label: "Active Projects",
            value: "12",
            icon: FolderKanban,
            change: "+3 this month",
            link: "/admin/projects",
          },
          {
            label: "New Enquiries",
            value: "7",
            icon: TrendingUp,
            change: "+18% vs last week",
            link: "/admin/contact-submissions",
          },
          {
            label: "Outstanding",
            value: "\u00A32,400",
            icon: Receipt,
            change: "2 invoices",
            amber: true,
            link: "/admin/invoices",
          },
          {
            label: "Unread Messages",
            value: "5",
            icon: MessageCircle,
            change: "3 clients",
            link: "/admin/messages",
          },
        ].map((stat, i) => (
          <Link key={stat.label} to={stat.link}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className={`${c} border rounded-2xl p-6 hover:-translate-y-0.5 transition-transform cursor-pointer`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.amber ? "bg-amber-500/10" : darkMode ? "bg-[#4A8C5C]/10" : "bg-[#1C4A3A]/10"}`}
              >
                <stat.icon
                  size={18}
                  className={stat.amber ? "text-amber-500" : acc}
                />
              </div>
              <span className={`text-[11px] uppercase tracking-[0.2em] ${t2}`}>
                {stat.label}
              </span>
              <p
                className={`mt-1 ${stat.amber ? "text-amber-500" : t1}`}
                style={{ fontSize: "1.4rem", fontWeight: 600 }}
              >
                {stat.value}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowUpRight size={12} className={acc} />
                <span className={`text-[11px] ${t2}`}>{stat.change}</span>
              </div>
            </motion.div>
          </Link>
        ))}

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`${c} border rounded-2xl p-6 lg:col-span-2`}
        >
          <h4 className={`${t1} mb-4`} style={{ fontSize: "1rem" }}>
            Monthly Bookings
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bookingsData}>
              <XAxis
                dataKey="month"
                tick={{ fill: darkMode ? "#8A8A82" : "#6B6B65", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: darkMode ? "#8A8A82" : "#6B6B65", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: darkMode ? "#1C1C1A" : "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="bookings"
                fill={darkMode ? "#4A8C5C" : "#1C4A3A"}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Messages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className={`${c} border rounded-2xl p-6 lg:col-span-2`}
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className={t1} style={{ fontSize: "1rem" }}>
              Recent Messages
            </h4>
            <Link
              to="/admin/messages"
              className={`text-[12px] ${acc} hover:underline`}
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentMessages.map((m) => (
              <Link
                key={m.client}
                to="/admin/messages"
                className={`flex items-center gap-3 p-2 rounded-xl ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"} transition-colors`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] text-white flex-shrink-0 ${accBg}`}
                >
                  {m.client[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] ${t1}`}
                    style={{ fontWeight: 500 }}
                  >
                    {m.client}
                  </p>
                  <p className={`text-[11px] ${t2} truncate`}>{m.msg}</p>
                </div>
                <span className={`text-[10px] ${t2} flex-shrink-0`}>
                  {m.time}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`px-6 py-4 flex items-center justify-between border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
              >
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  {activeModal === "booking"
                    ? "New Booking"
                    : activeModal === "client"
                      ? "Add Client"
                      : "Create Invoice"}
                </h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className={`p-1 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
                >
                  <X size={18} className={t2} />
                </button>
              </div>
              <div className="p-6">
                {activeModal === "booking" && (
                  <form onSubmit={handleBookingSubmit} className="space-y-4">
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Client Name
                      </label>
                      <input
                        required
                        value={bookingForm.client}
                        onChange={(e) =>
                          setBookingForm({
                            ...bookingForm,
                            client: e.target.value,
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        placeholder="Search or enter name..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`text-[12px] ${t2} block mb-1`}>
                          Date
                        </label>
                        <input
                          required
                          type="date"
                          value={bookingForm.date}
                          onChange={(e) =>
                            setBookingForm({
                              ...bookingForm,
                              date: e.target.value,
                            })
                          }
                          className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        />
                      </div>
                      <div>
                        <label className={`text-[12px] ${t2} block mb-1`}>
                          Time
                        </label>
                        <input
                          required
                          type="time"
                          value={bookingForm.time}
                          onChange={(e) =>
                            setBookingForm({
                              ...bookingForm,
                              time: e.target.value,
                            })
                          }
                          className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Service
                      </label>
                      <select
                        value={bookingForm.service}
                        onChange={(e) =>
                          setBookingForm({
                            ...bookingForm,
                            service: e.target.value,
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                      >
                        <option>Kitchen</option>
                        <option>Bedroom</option>
                        <option>Media Wall</option>
                        <option>Wardrobe</option>
                        <option>Consultation</option>
                      </select>
                    </div>
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Notes
                      </label>
                      <textarea
                        rows={3}
                        value={bookingForm.notes}
                        onChange={(e) =>
                          setBookingForm({
                            ...bookingForm,
                            notes: e.target.value,
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none resize-none ${inp}`}
                        placeholder="Additional notes..."
                      />
                    </div>
                    <button
                      type="submit"
                      className={`w-full py-3 rounded-full text-[14px] text-white ${accBg}`}
                    >
                      Create Booking
                    </button>
                  </form>
                )}
                {activeModal === "client" && (
                  <form onSubmit={handleClientSubmit} className="space-y-4">
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Full Name
                      </label>
                      <input
                        required
                        value={clientForm.name}
                        onChange={(e) =>
                          setClientForm({ ...clientForm, name: e.target.value })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        placeholder="Client name"
                      />
                    </div>
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Email
                      </label>
                      <input
                        required
                        type="email"
                        value={clientForm.email}
                        onChange={(e) =>
                          setClientForm({
                            ...clientForm,
                            email: e.target.value,
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        placeholder="client@email.com"
                      />
                    </div>
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Phone
                      </label>
                      <input
                        value={clientForm.phone}
                        onChange={(e) =>
                          setClientForm({
                            ...clientForm,
                            phone: e.target.value,
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        placeholder="07XXX XXXXXX"
                      />
                    </div>
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Address
                      </label>
                      <input
                        value={clientForm.address}
                        onChange={(e) =>
                          setClientForm({
                            ...clientForm,
                            address: e.target.value,
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        placeholder="Address"
                      />
                    </div>
                    <button
                      type="submit"
                      className={`w-full py-3 rounded-full text-[14px] text-white ${accBg}`}
                    >
                      Add Client
                    </button>
                  </form>
                )}
                {activeModal === "invoice" && (
                  <form onSubmit={handleInvoiceSubmit} className="space-y-4">
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Client
                      </label>
                      <select
                        value={invoiceForm.client}
                        onChange={(e) =>
                          setInvoiceForm({
                            ...invoiceForm,
                            client: e.target.value,
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                      >
                        <option value="">Select client...</option>
                        <option>Sarah Thompson</option>
                        <option>James Mitchell</option>
                        <option>Emma Richardson</option>
                        <option>David Chen</option>
                      </select>
                    </div>
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Project
                      </label>
                      <input
                        value={invoiceForm.project}
                        onChange={(e) =>
                          setInvoiceForm({
                            ...invoiceForm,
                            project: e.target.value,
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        placeholder="Project name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`text-[12px] ${t2} block mb-1`}>
                          Amount (£)
                        </label>
                        <input
                          required
                          type="number"
                          value={invoiceForm.amount}
                          onChange={(e) =>
                            setInvoiceForm({
                              ...invoiceForm,
                              amount: e.target.value,
                            })
                          }
                          className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className={`text-[12px] ${t2} block mb-1`}>
                          Due Date
                        </label>
                        <input
                          required
                          type="date"
                          value={invoiceForm.dueDate}
                          onChange={(e) =>
                            setInvoiceForm({
                              ...invoiceForm,
                              dueDate: e.target.value,
                            })
                          }
                          className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Line Items
                      </label>
                      <textarea
                        rows={3}
                        value={invoiceForm.items}
                        onChange={(e) =>
                          setInvoiceForm({
                            ...invoiceForm,
                            items: e.target.value,
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none resize-none ${inp}`}
                        placeholder="Design phase, Manufacturing, Installation..."
                      />
                    </div>
                    <button
                      type="submit"
                      className={`w-full py-3 rounded-full text-[14px] text-white ${accBg}`}
                    >
                      Create Invoice
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
