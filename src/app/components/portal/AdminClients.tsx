import { useState } from "react";
import { useOutletContext, Link, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  X,
  MessageCircle,
  Receipt,
  FolderPlus,
  FileText,
  Upload,
  Download,
  Trash2,
  Edit2,
  UserPlus,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

const clients = [
  {
    id: 1,
    name: "Sarah Thompson",
    email: "sarah@email.com",
    phone: "07XXX XXX001",
    address: "14 Oak Lane, Oadby, LE2",
    projects: 2,
    lastActivity: "2 hours ago",
    status: "Active",
    joinDate: "Jan 2026",
    totalSpent: 3600,
    assignedTo: "Oyz Khan",
    files: [
      { name: "Bedroom Design V3.pdf", size: "2.4 MB", date: "Feb 28" },
      { name: "Contract.pdf", size: "340 KB", date: "Feb 10" },
      { name: "Mood Board.png", size: "5.1 MB", date: "Feb 12" },
    ],
    notes:
      "Prefers sage green palette. Has two cats - consider pet-friendly materials.",
  },
  {
    id: 2,
    name: "James Mitchell",
    email: "james@email.com",
    phone: "07XXX XXX002",
    address: "8 Victoria Rd, Stoneygate, LE2",
    projects: 1,
    lastActivity: "1 day ago",
    status: "Active",
    joinDate: "Feb 2026",
    totalSpent: 0,
    assignedTo: "Design Team",
    files: [{ name: "Kitchen Quote.pdf", size: "180 KB", date: "Feb 20" }],
    notes: "Budget-conscious. Interested in financing options.",
  },
  {
    id: 3,
    name: "Emma Richardson",
    email: "emma@email.com",
    phone: "07XXX XXX003",
    address: "22 Park Ave, Clarendon Park, LE2",
    projects: 1,
    lastActivity: "3 days ago",
    status: "Active",
    joinDate: "Jan 2026",
    totalSpent: 800,
    assignedTo: "Oyz Khan",
    files: [{ name: "Media Wall Concept.pdf", size: "1.2 MB", date: "Feb 15" }],
    notes: "Wants 75-inch TV integration with electric fireplace.",
  },
  {
    id: 4,
    name: "David Chen",
    email: "david@email.com",
    phone: "07XXX XXX004",
    address: "5 Meadow Close, Knighton, LE2",
    projects: 1,
    lastActivity: "5 days ago",
    status: "Active",
    joinDate: "Feb 2026",
    totalSpent: 0,
    assignedTo: "Design Team",
    files: [],
    notes: "Walk-in wardrobe for master bedroom. Room is 3m x 4m.",
  },
  {
    id: 5,
    name: "Rachel Adams",
    email: "rachel@email.com",
    phone: "07XXX XXX005",
    address: "11 Church St, Wigston, LE18",
    projects: 3,
    lastActivity: "1 week ago",
    status: "Inactive",
    joinDate: "Sep 2025",
    totalSpent: 12500,
    assignedTo: "Oyz Khan",
    files: [
      { name: "Full Home Plans.pdf", size: "8.2 MB", date: "Dec 1" },
      { name: "Final Invoice.pdf", size: "120 KB", date: "Dec 20" },
    ],
    notes:
      "Full home renovation completed. Very happy customer - good for referrals.",
  },
  {
    id: 6,
    name: "Priya Patel",
    email: "priya@email.com",
    phone: "07XXX XXX006",
    address: "3 Cedar Dr, Evington, LE5",
    projects: 1,
    lastActivity: "2 weeks ago",
    status: "Active",
    joinDate: "Jan 2026",
    totalSpent: 0,
    assignedTo: "Design Team",
    files: [{ name: "Kitchen Samples.png", size: "3.2 MB", date: "Feb 20" }],
    notes: "Sage green kitchen. Very specific about colour matching.",
  },
];

const teamMembers = ["Oyz Khan", "Design Team", "Installation Team"];

export function AdminClients() {
  usePageTitle("Clients - Admin Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [clientList, setClientList] = useState(clients);
  const [editClient, setEditClient] = useState<(typeof clients)[0] | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [addClientModal, setAddClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
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

  const filtered = clientList.filter((cl) =>
    cl.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = Math.max(...clientList.map((c) => c.id)) + 1;
    setClientList([
      ...clientList,
      {
        id: newId,
        name: newClientForm.name,
        email: newClientForm.email,
        phone: newClientForm.phone,
        address: newClientForm.address,
        projects: 0,
        lastActivity: "Just now",
        status: "Active",
        joinDate: new Date().toLocaleDateString("en-GB", {
          month: "short",
          year: "numeric",
        }),
        totalSpent: 0,
        assignedTo: "Design Team",
        files: [],
        notes: "",
      },
    ]);
    toast.success(`Client "${newClientForm.name}" added successfully!`);
    setAddClientModal(false);
    setNewClientForm({ name: "", email: "", phone: "", address: "" });
  };

  const handleSaveEdit = () => {
    if (editClient) {
      setClientList(
        clientList.map((c) => (c.id === editClient.id ? editClient : c)),
      );
      setEditClient(null);
      toast.success("Client updated successfully!");
    }
  };

  const handleDeleteClient = (id: number) => {
    setClientList(clientList.filter((c) => c.id !== id));
    setDeleteConfirm(null);
    toast.success("Client deleted.");
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
          All Clients
        </motion.h1>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
          >
            <Search size={14} className={t2} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className={`bg-transparent text-[13px] focus:outline-none w-32 ${darkMode ? "text-[#F0EEE9] placeholder-[#8A8A82]" : "text-[#2C2C2C] placeholder-[#C4B8A8]"}`}
            />
          </div>
          <button
            onClick={() => setAddClientModal(true)}
            className={`px-4 py-2 rounded-full text-[12px] text-white flex items-center gap-1 ${accBg}`}
          >
            <UserPlus size={12} /> Add Client
          </button>
        </div>
      </div>

      <div className={`${c} border rounded-2xl overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr
              className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
            >
              <th
                className={`text-left text-[11px] uppercase tracking-wider ${t2} px-4 py-3 w-[220px] flex-shrink-0`}
              >
                Client
              </th>
              <th
                className={`text-left text-[11px] uppercase tracking-wider ${t2} px-4 py-3 w-[220px] flex-shrink-0`}
              >
                Email
              </th>
              <th
                className={`text-left text-[11px] uppercase tracking-wider ${t2} px-4 py-3 w-[110px] flex-shrink-0`}
              >
                Projects
              </th>
              <th
                className={`text-left text-[11px] uppercase tracking-wider ${t2} px-4 py-3 w-[140px] flex-shrink-0`}
              >
                Assigned To
              </th>
              <th
                className={`text-left text-[11px] uppercase tracking-wider ${t2} px-4 py-3 w-[110px] flex-shrink-0`}
              >
                Spent
              </th>
              <th
                className={`text-left text-[11px] uppercase tracking-wider ${t2} px-4 py-3 w-[110px] flex-shrink-0`}
              >
                Status
              </th>
              <th
                className={`text-left text-[11px] uppercase tracking-wider ${t2} px-4 py-3 w-[120px] flex-shrink-0`}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cl, i) => (
              <motion.tr
                key={cl.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/admin/clients/${cl.id}`)}
                className={`border-b ${darkMode ? "border-[#2A2A28] hover:bg-[#2A2A28]/50" : "border-[#C4B8A8]/10 hover:bg-[#F5F4F0]"} cursor-pointer transition-colors`}
              >
                <td className="px-4 py-3 w-[220px] flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] text-white flex-shrink-0 ${accBg}`}
                    >
                      {cl.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <span
                        className={`text-[13px] ${t1} block truncate whitespace-nowrap`}
                      >
                        {cl.name}
                      </span>
                      <p
                        className={`text-[10px] ${t2} truncate whitespace-nowrap`}
                      >
                        {cl.phone}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 w-[220px] flex-shrink-0">
                  <span
                    className={`text-[12px] ${t2} block truncate whitespace-nowrap`}
                  >
                    {cl.email}
                  </span>
                </td>
                <td className="px-4 py-3 w-[110px] flex-shrink-0">
                  <span className={`text-[12px] ${t1}`}>{cl.projects}</span>
                </td>
                <td className="px-4 py-3 w-[140px] flex-shrink-0">
                  <span
                    className={`text-[11px] ${t2} block truncate whitespace-nowrap`}
                  >
                    {cl.assignedTo}
                  </span>
                </td>
                <td className="px-4 py-3 w-[110px] flex-shrink-0">
                  <span className={`text-[12px] ${t1} block whitespace-nowrap`}>
                    &pound;{cl.totalSpent.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 w-[110px] flex-shrink-0">
                  <span
                    className={`px-2 py-1 rounded-full text-[10px] whitespace-nowrap ${cl.status === "Active" ? (darkMode ? "bg-[#4A8C5C]/20 text-[#4A8C5C]" : "bg-[#1C4A3A]/10 text-[#1C4A3A]") : "bg-amber-500/10 text-amber-500"}`}
                  >
                    {cl.status}
                  </span>
                </td>
                <td
                  className="px-4 py-3 w-[160px] flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/admin/clients/${cl.id}`}
                      className={`px-3 py-1.5 rounded-full text-[11px] ${darkMode ? "bg-[#2A2A28] text-[#F0EEE9] hover:bg-[#4A8C5C]" : "bg-[#EAE7E0] text-[#1C4A3A] hover:bg-[#1C4A3A] hover:text-white"} transition-colors inline-flex items-center gap-1 whitespace-nowrap`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye size={12} />
                      View
                    </Link>
                    <button
                      onClick={() => setEditClient({ ...cl })}
                      className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#EAE7E0]"}`}
                      title="Edit"
                    >
                      <Edit2 size={13} className={acc} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(cl.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Client Modal */}
      <AnimatePresence>
        {editClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditClient(null)}
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
                  Edit Client
                </h3>
                <button onClick={() => setEditClient(null)}>
                  <X size={18} className={t2} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editClient.name}
                    onChange={(e) =>
                      setEditClient({ ...editClient, name: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={editClient.email}
                    onChange={(e) =>
                      setEditClient({ ...editClient, email: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Phone
                  </label>
                  <input
                    type="text"
                    value={editClient.phone}
                    onChange={(e) =>
                      setEditClient({ ...editClient, phone: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Address
                  </label>
                  <input
                    type="text"
                    value={editClient.address}
                    onChange={(e) =>
                      setEditClient({ ...editClient, address: e.target.value })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Status
                    </label>
                    <select
                      value={editClient.status}
                      onChange={(e) =>
                        setEditClient({ ...editClient, status: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Assigned To
                    </label>
                    <select
                      value={editClient.assignedTo}
                      onChange={(e) =>
                        setEditClient({
                          ...editClient,
                          assignedTo: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    >
                      {teamMembers.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleSaveEdit}
                  className={`w-full py-3 rounded-full text-[14px] text-white ${accBg}`}
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-sm w-full p-6`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={`${t1} mb-2`} style={{ fontSize: "1.1rem" }}>
                Delete Client?
              </h3>
              <p className={`text-[13px] ${t2} mb-6`}>
                This action cannot be undone. The client and all associated data
                will be removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className={`flex-1 py-3 rounded-full text-[14px] ${darkMode ? "bg-[#2A2A28] text-[#F0EEE9]" : "bg-[#EAE7E0] text-[#2C2C2C]"}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteClient(deleteConfirm)}
                  className="flex-1 py-3 rounded-full text-[14px] text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Client Modal */}
      <AnimatePresence>
        {addClientModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setAddClientModal(false)}
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
                  Add New Client
                </h3>
                <button onClick={() => setAddClientModal(false)}>
                  <X size={18} className={t2} />
                </button>
              </div>
              <form onSubmit={handleAddClient} className="space-y-4">
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Full Name
                  </label>
                  <input
                    required
                    value={newClientForm.name}
                    onChange={(e) =>
                      setNewClientForm({
                        ...newClientForm,
                        name: e.target.value,
                      })
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
                    value={newClientForm.email}
                    onChange={(e) =>
                      setNewClientForm({
                        ...newClientForm,
                        email: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Phone
                  </label>
                  <input
                    value={newClientForm.phone}
                    onChange={(e) =>
                      setNewClientForm({
                        ...newClientForm,
                        phone: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <div>
                  <label className={`text-[12px] ${t2} block mb-1`}>
                    Address
                  </label>
                  <input
                    value={newClientForm.address}
                    onChange={(e) =>
                      setNewClientForm({
                        ...newClientForm,
                        address: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                  />
                </div>
                <button
                  type="submit"
                  className={`w-full py-3 rounded-full text-[14px] text-white ${accBg}`}
                >
                  Add Client
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
