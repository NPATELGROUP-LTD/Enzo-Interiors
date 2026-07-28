import { useState } from "react";
import { useOutletContext } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Edit, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

interface Testimonial {
  id: number;
  name: string;
  company: string;
  rating: number;
  text: string;
  imageUrl: string;
  date: string;
}

const initialTestimonials: Testimonial[] = [
  {
    id: 1,
    name: "Sarah Thompson",
    company: "Private Residence",
    rating: 5,
    text: "Enzo Interiors transformed our bedroom beyond our wildest dreams. The attention to detail and quality of craftsmanship is outstanding. Every morning I wake up feeling like I'm in a luxury hotel.",
    imageUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    date: "Feb 15, 2026",
  },
  {
    id: 2,
    name: "James Mitchell",
    company: "Mitchell & Co.",
    rating: 5,
    text: "Our kitchen redesign was executed flawlessly. The team was professional, punctual, and the end result exceeded all expectations. Worth every penny!",
    imageUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    date: "Jan 28, 2026",
  },
  {
    id: 3,
    name: "Emma Richardson",
    company: "Richardson Properties",
    rating: 5,
    text: "The media wall installation completely transformed our living space. Enzo's design expertise and quality of materials are second to none.",
    imageUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    date: "Jan 10, 2026",
  },
  {
    id: 4,
    name: "David Chen",
    company: "Chen Architects",
    rating: 4,
    text: "Excellent service from start to finish. The walk-in wardrobe design is both beautiful and functional. Minor delays but the quality made up for it.",
    imageUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    date: "Dec 5, 2025",
  },
];

export function AdminTestimonials() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [testimonials, setTestimonials] = useState(initialTestimonials);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<Testimonial | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    rating: 5,
    text: "",
    imageUrl: "",
  });

  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const acc = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";

  const averageRating = (
    testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length
  ).toFixed(1);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newTestimonial: Testimonial = {
      id: Math.max(...testimonials.map((t) => t.id), 0) + 1,
      ...formData,
      date: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    };
    setTestimonials([newTestimonial, ...testimonials]);
    toast.success("Testimonial created successfully!");
    setCreateModal(false);
    setFormData({ name: "", company: "", rating: 5, text: "", imageUrl: "" });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setTestimonials(
      testimonials.map((t) =>
        t.id === editModal.id ? { ...t, ...formData } : t,
      ),
    );
    toast.success("Testimonial updated successfully!");
    setEditModal(null);
    setFormData({ name: "", company: "", rating: 5, text: "", imageUrl: "" });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this testimonial?")) {
      setTestimonials(testimonials.filter((t) => t.id !== id));
      toast.success("Testimonial deleted!");
    }
  };

  const openEditModal = (testimonial: Testimonial) => {
    setEditModal(testimonial);
    setFormData({
      name: testimonial.name,
      company: testimonial.company,
      rating: testimonial.rating,
      text: testimonial.text,
      imageUrl: testimonial.imageUrl,
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
          Testimonials
        </motion.h1>
        <button
          onClick={() => setCreateModal(true)}
          className={`px-4 py-2 rounded-full text-[12px] text-white flex items-center gap-1 ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
        >
          <Plus size={12} /> Add Testimonial
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${c} border rounded-2xl p-5`}
        >
          <span className={`text-[11px] uppercase tracking-[0.2em] ${t2}`}>
            Total Testimonials
          </span>
          <p
            className={`mt-1 ${acc}`}
            style={{ fontSize: "1.3rem", fontWeight: 600 }}
          >
            {testimonials.length}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`${c} border rounded-2xl p-5`}
        >
          <span className={`text-[11px] uppercase tracking-[0.2em] ${t2}`}>
            Average Rating
          </span>
          <p
            className={`mt-1 ${acc}`}
            style={{ fontSize: "1.3rem", fontWeight: 600 }}
          >
            {averageRating} <Star size={16} className="inline fill-current" />
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${c} border rounded-2xl p-5`}
        >
          <span className={`text-[11px] uppercase tracking-[0.2em] ${t2}`}>
            5-Star Reviews
          </span>
          <p
            className={`mt-1 ${acc}`}
            style={{ fontSize: "1.3rem", fontWeight: 600 }}
          >
            {testimonials.filter((t) => t.rating === 5).length}
          </p>
        </motion.div>
      </div>

      {/* Testimonials Table */}
      <div className={`${c} border rounded-2xl overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr
              className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
            >
              {[
                "Client",
                "Company",
                "Rating",
                "Testimonial",
                "Date",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className={`text-left text-[11px] uppercase tracking-wider ${t2} px-4 py-3`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {testimonials.map((testimonial, i) => (
              <tr
                key={testimonial.id}
                className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/10"} ${darkMode ? "hover:bg-[#2A2A28]/50" : "hover:bg-[#F5F4F0]"} transition-colors`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={testimonial.imageUrl}
                      alt={testimonial.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <p
                      className={`text-[13px] ${t1}`}
                      style={{ fontWeight: 500 }}
                    >
                      {testimonial.name}
                    </p>
                  </div>
                </td>
                <td className={`px-4 py-3 text-[12px] ${t2}`}>
                  {testimonial.company}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={
                          i < testimonial.rating ? `${acc} fill-current` : t2
                        }
                      />
                    ))}
                  </div>
                </td>
                <td className={`px-4 py-3 text-[12px] ${t2} max-w-xs`}>
                  {testimonial.text.length > 80
                    ? testimonial.text.substring(0, 80) + "..."
                    : testimonial.text}
                </td>
                <td className={`px-4 py-3 text-[12px] ${t2}`}>
                  {testimonial.date}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(testimonial)}
                      className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#EAE7E0]"}`}
                      title="Edit"
                    >
                      <Edit size={14} className={acc} />
                    </button>
                    <button
                      onClick={() => handleDelete(testimonial.id)}
                      className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#EAE7E0]"}`}
                      title="Delete"
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {createModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-lg w-full p-6`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Add Testimonial
                </h3>
                <button onClick={() => setCreateModal(false)}>
                  <X size={18} className={t2} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Client Name
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Company
                  </label>
                  <input
                    required
                    value={formData.company}
                    onChange={(e) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating })}
                        className={`p-2 rounded-lg ${formData.rating >= rating ? (darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]") : darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
                      >
                        <Star
                          size={20}
                          className={
                            formData.rating >= rating
                              ? "text-white fill-current"
                              : t2
                          }
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Testimonial Text
                  </label>
                  <textarea
                    required
                    value={formData.text}
                    onChange={(e) =>
                      setFormData({ ...formData, text: e.target.value })
                    }
                    rows={4}
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none resize-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    placeholder="Write the testimonial..."
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Image URL
                  </label>
                  <input
                    required
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, imageUrl: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    placeholder="https://..."
                  />
                  <p className={`text-[10px] ${t2} mt-1`}>
                    Use Unsplash or another image URL
                  </p>
                </div>
                <button
                  type="submit"
                  className={`w-full py-3 rounded-full text-[14px] text-white ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                >
                  Create Testimonial
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-lg w-full p-6`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Edit Testimonial
                </h3>
                <button onClick={() => setEditModal(null)}>
                  <X size={18} className={t2} />
                </button>
              </div>
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Client Name
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Company
                  </label>
                  <input
                    required
                    value={formData.company}
                    onChange={(e) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating })}
                        className={`p-2 rounded-lg ${formData.rating >= rating ? (darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]") : darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
                      >
                        <Star
                          size={20}
                          className={
                            formData.rating >= rating
                              ? "text-white fill-current"
                              : t2
                          }
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Testimonial Text
                  </label>
                  <textarea
                    required
                    value={formData.text}
                    onChange={(e) =>
                      setFormData({ ...formData, text: e.target.value })
                    }
                    rows={4}
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none resize-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    placeholder="Write the testimonial..."
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Image URL
                  </label>
                  <input
                    required
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, imageUrl: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    placeholder="https://..."
                  />
                </div>
                <button
                  type="submit"
                  className={`w-full py-3 rounded-full text-[14px] text-white ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                >
                  Update Testimonial
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
