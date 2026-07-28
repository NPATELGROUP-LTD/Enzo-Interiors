import { useState } from "react";
import { useOutletContext } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X, Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const initialBookings = [
  { id: 1, client: "Sarah Thompson", date: "Mar 2", time: "9:00am", service: "Bedroom", status: "Confirmed", phone: "07XXX XXX001", notes: "Follow-up on wardrobe changes" },
  { id: 2, client: "James Mitchell", date: "Mar 3", time: "11:00am", service: "Kitchen", status: "Confirmed", phone: "07XXX XXX002", notes: "Initial consultation" },
  { id: 3, client: "Emma Chen", date: "Mar 5", time: "2:00pm", service: "Media Wall", status: "Pending", phone: "07XXX XXX003", notes: "Wants fireplace integration" },
  { id: 4, client: "David Chen", date: "Mar 8", time: "10:30am", service: "Wardrobe", status: "Confirmed", phone: "07XXX XXX004", notes: "Walk-in wardrobe design review" },
  { id: 5, client: "Priya Patel", date: "Mar 10", time: "3:00pm", service: "Kitchen", status: "Pending", phone: "07XXX XXX006", notes: "Sage green kitchen follow-up" },
];

export function AdminBookings() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [currentMonth, setCurrentMonth] = useState(2);
  const [bookings, setBookings] = useState(initialBookings);
  const [selectedBooking, setSelectedBooking] = useState<typeof bookings[0] | null>(null);
  const [newBookingModal, setNewBookingModal] = useState(false);
  const [newBooking, setNewBooking] = useState({ client: "", date: "", time: "", service: "Kitchen", notes: "" });
  const [editAvailability, setEditAvailability] = useState(false);

  const c = darkMode ? "bg-[#1C1C1A] border-[#2A2A28]" : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const acc = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const accBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";
  const inp = darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9] placeholder-[#8A8A82]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C] placeholder-[#C4B8A8]";

  const daysInMonth = new Date(2026, currentMonth + 1, 0).getDate();
  const firstDay = new Date(2026, currentMonth, 1).getDay();
  const bookedDays = [2, 3, 5, 8, 10, 15, 18, 22, 25];
  const blockedDays = [7, 14, 21, 28];

  const [availSettings, setAvailSettings] = useState({
    slotDuration: "60", maxPerDay: "4",
    hours: { weekday: { start: "09:00", end: "17:00" }, saturday: { start: "10:00", end: "14:00" } },
  });

  const handleConfirm = (id: number) => {
    setBookings(bookings.map(b => b.id === id ? { ...b, status: "Confirmed" } : b));
    toast.success("Booking confirmed!");
  };

  const handleCancel = (id: number) => {
    setBookings(bookings.filter(b => b.id !== id));
    if (selectedBooking?.id === id) setSelectedBooking(null);
    toast.success("Booking cancelled");
  };

  const handleNewBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBookings([...bookings, { id: Date.now(), client: newBooking.client, date: newBooking.date, time: newBooking.time, service: newBooking.service, status: "Confirmed", phone: "", notes: newBooking.notes }]);
    toast.success("Booking created!");
    setNewBookingModal(false);
    setNewBooking({ client: "", date: "", time: "", service: "Kitchen", notes: "" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={t1} style={{ fontSize: "1.8rem" }}>Bookings & Availability</motion.h1>
        <button onClick={() => setNewBookingModal(true)} className={`px-4 py-2 rounded-full text-[12px] text-white flex items-center gap-1 ${accBg}`}><Plus size={12} /> Manual Booking</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Calendar */}
        <div className={`${c} border rounded-2xl p-6 lg:col-span-3`}>
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setCurrentMonth(m => Math.max(0, m - 1))} className={t2}><ChevronLeft size={20} /></button>
            <span className={`${t1} text-[15px]`} style={{ fontWeight: 500 }}>{months[currentMonth]} 2026</span>
            <button onClick={() => setCurrentMonth(m => Math.min(11, m + 1))} className={t2}><ChevronRight size={20} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} className={`text-[10px] uppercase tracking-wider py-2 ${t2}`}>{d}</div>
            ))}
            {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isBooked = bookedDays.includes(day);
              const isBlocked = blockedDays.includes(day);
              return (
                <div key={day} onClick={() => { if (isBooked) { const booking = bookings.find(b => b.date.includes(String(day))); if (booking) setSelectedBooking(booking); } }}
                  className={`h-10 flex items-center justify-center rounded-lg text-[13px] relative ${
                    isBlocked ? (darkMode ? "bg-[#2A2A28]/50 text-[#6B6B65]" : "bg-[#EAE7E0] text-[#C4B8A8]") :
                    isBooked ? (darkMode ? "text-[#F0EEE9]" : "text-[#2C2C2C]") : t2
                  } cursor-pointer ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"} transition-colors`}>
                  {day}
                  {isBooked && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${accBg}`} />}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-4 text-[11px]">
            <div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${accBg}`} /><span className={t2}>Booked</span></div>
            <div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${darkMode ? "bg-[#2A2A28]" : "bg-[#EAE7E0]"}`} /><span className={t2}>Blocked</span></div>
          </div>
        </div>

        {/* Availability Settings */}
        <div className={`${c} border rounded-2xl p-6 lg:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className={t1} style={{ fontSize: "1rem" }}>Availability</h4>
            <button onClick={() => setEditAvailability(!editAvailability)} className={`text-[11px] ${acc} flex items-center gap-1`}><Edit2 size={11} />{editAvailability ? "Done" : "Edit"}</button>
          </div>
          <div className="space-y-3">
            {["Monday","Tuesday","Wednesday","Thursday","Friday"].map(day => (
              <div key={day} className="flex items-center justify-between">
                <span className={`text-[12px] ${t1}`}>{day}</span>
                {editAvailability ? (
                  <div className="flex items-center gap-1">
                    <input type="time" defaultValue={availSettings.hours.weekday.start} className={`px-1 py-0.5 rounded text-[10px] w-20 ${inp} border focus:outline-none`} />
                    <span className={`text-[10px] ${t2}`}>-</span>
                    <input type="time" defaultValue={availSettings.hours.weekday.end} className={`px-1 py-0.5 rounded text-[10px] w-20 ${inp} border focus:outline-none`} />
                  </div>
                ) : <span className={`text-[11px] ${acc}`}>9:00am - 5:00pm</span>}
              </div>
            ))}
            {["Saturday","Sunday"].map(day => (
              <div key={day} className="flex items-center justify-between">
                <span className={`text-[12px] ${t2}`}>{day}</span>
                <span className={`text-[11px] ${t2}`}>Closed</span>
              </div>
            ))}
          </div>
          <div className={`mt-6 pt-4 border-t ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}>
            {editAvailability ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className={t2}>Slot Duration</span>
                  <select value={availSettings.slotDuration} onChange={e => setAvailSettings({...availSettings, slotDuration: e.target.value})} className={`px-2 py-1 rounded-lg border text-[11px] focus:outline-none ${inp}`}>
                    <option>30</option><option>45</option><option>60</option><option>90</option>
                  </select>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className={t2}>Max per Day</span>
                  <input type="number" value={availSettings.maxPerDay} onChange={e => setAvailSettings({...availSettings, maxPerDay: e.target.value})} className={`w-16 px-2 py-1 rounded-lg border text-[11px] text-center focus:outline-none ${inp}`} />
                </div>
                <button onClick={() => { setEditAvailability(false); toast.success("Availability saved!"); }} className={`w-full py-2 rounded-full text-[12px] text-white ${accBg}`}>Save</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[12px]"><span className={t2}>Slot Duration</span><span className={t1}>{availSettings.slotDuration} min</span></div>
                <div className="flex items-center justify-between text-[12px] mt-2"><span className={t2}>Max per Day</span><span className={t1}>{availSettings.maxPerDay}</span></div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming bookings */}
      <div className={`${c} border rounded-2xl mt-6 overflow-hidden`}>
        <div className="p-4"><h4 className={t1} style={{ fontSize: "1rem" }}>Upcoming Bookings</h4></div>
        {bookings.map((b, i) => (
          <div key={b.id} className={`flex items-center justify-between px-4 py-3 cursor-pointer ${i % 2 === 0 ? "" : (darkMode ? "bg-[#1E1E1C]" : "bg-[#FAFAF8]")} ${darkMode ? "hover:bg-[#2A2A28]/50" : "hover:bg-[#F5F4F0]"} transition-colors`}
            onClick={() => setSelectedBooking(b)}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] text-white ${accBg}`}>{b.client.split(" ").map(n => n[0]).join("")}</div>
              <div>
                <p className={`text-[13px] ${t1}`}>{b.client}</p>
                <p className={`text-[11px] ${t2}`}>{b.date} &middot; {b.time} &middot; {b.service}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-[10px] ${b.status === "Confirmed" ? (darkMode ? "bg-[#4A8C5C]/20 text-[#4A8C5C]" : "bg-[#1C4A3A]/10 text-[#1C4A3A]") : "bg-amber-500/10 text-amber-500"}`}>{b.status}</span>
              {b.status === "Pending" && <button onClick={e => { e.stopPropagation(); handleConfirm(b.id); }} className={`px-3 py-1 rounded-full text-[10px] text-white ${accBg}`}>Confirm</button>}
              <button onClick={e => { e.stopPropagation(); handleCancel(b.id); }} className="px-2 py-1 rounded-full text-[10px] bg-red-500/10 text-red-500">Cancel</button>
            </div>
          </div>
        ))}
      </div>

      {/* Booking Detail Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-md w-full p-6`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>Booking Details</h3>
                <button onClick={() => setSelectedBooking(null)}><X size={18} className={t2} /></button>
              </div>
              <div className={`text-center py-4 mb-4 rounded-xl ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-[18px] text-white mx-auto ${accBg}`}>{selectedBooking.client.split(" ").map(n => n[0]).join("")}</div>
                <h4 className={`mt-2 ${t1}`}>{selectedBooking.client}</h4>
                <span className={`px-3 py-0.5 rounded-full text-[10px] ${selectedBooking.status === "Confirmed" ? (darkMode ? "bg-[#4A8C5C]/20 text-[#4A8C5C]" : "bg-[#1C4A3A]/10 text-[#1C4A3A]") : "bg-amber-500/10 text-amber-500"}`}>{selectedBooking.status}</span>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-[13px]"><span className={t2}>Date</span><span className={t1}>{selectedBooking.date}, 2026</span></div>
                <div className="flex justify-between text-[13px]"><span className={t2}>Time</span><span className={t1}>{selectedBooking.time}</span></div>
                <div className="flex justify-between text-[13px]"><span className={t2}>Service</span><span className={t1}>{selectedBooking.service}</span></div>
                <div className="flex justify-between text-[13px]"><span className={t2}>Phone</span><span className={t1}>{selectedBooking.phone || "—"}</span></div>
                {selectedBooking.notes && <div><span className={`text-[12px] ${t2} block mb-1`}>Notes</span><p className={`text-[13px] ${t1} p-3 rounded-lg ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}>{selectedBooking.notes}</p></div>}
              </div>
              <div className="flex gap-2">
                {selectedBooking.status === "Pending" && <button onClick={() => { handleConfirm(selectedBooking.id); setSelectedBooking({...selectedBooking, status: "Confirmed"}); }} className={`flex-1 py-2.5 rounded-full text-[13px] text-white ${accBg}`}>Confirm</button>}
                <button onClick={() => toast.success("Reschedule initiated")} className={`flex-1 py-2.5 rounded-full text-[13px] border ${darkMode ? "border-[#2A2A28] text-[#8A8A82]" : "border-[#C4B8A8] text-[#6B6B65]"}`}>Reschedule</button>
                <button onClick={() => { handleCancel(selectedBooking.id); }} className="flex-1 py-2.5 rounded-full text-[13px] bg-red-500/10 text-red-500">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Booking Modal */}
      <AnimatePresence>
        {newBookingModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setNewBookingModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-md w-full p-6`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>New Manual Booking</h3>
                <button onClick={() => setNewBookingModal(false)}><X size={18} className={t2} /></button>
              </div>
              <form onSubmit={handleNewBooking} className="space-y-4">
                <div><label className={`text-[12px] ${t2} block mb-1`}>Client</label><input required value={newBooking.client} onChange={e => setNewBooking({...newBooking, client: e.target.value})} className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`} placeholder="Client name" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`text-[12px] ${t2} block mb-1`}>Date</label><input required value={newBooking.date} onChange={e => setNewBooking({...newBooking, date: e.target.value})} className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`} placeholder="Mar 15" /></div>
                  <div><label className={`text-[12px] ${t2} block mb-1`}>Time</label><input required value={newBooking.time} onChange={e => setNewBooking({...newBooking, time: e.target.value})} className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`} placeholder="10:00am" /></div>
                </div>
                <div><label className={`text-[12px] ${t2} block mb-1`}>Service</label>
                  <select value={newBooking.service} onChange={e => setNewBooking({...newBooking, service: e.target.value})} className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}>
                    <option>Kitchen</option><option>Bedroom</option><option>Media Wall</option><option>Wardrobe</option><option>Consultation</option>
                  </select>
                </div>
                <div><label className={`text-[12px] ${t2} block mb-1`}>Notes</label><textarea rows={2} value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})} className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none resize-none ${inp}`} /></div>
                <button type="submit" className={`w-full py-3 rounded-full text-[14px] text-white ${accBg}`}>Create Booking</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
