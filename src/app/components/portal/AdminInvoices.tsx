import { useState } from "react";
import { useOutletContext } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Download, Send, Check, X, Plus, Eye, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

const initialInvoices = [
  {
    id: "INV-001",
    client: "Sarah Thompson",
    project: "Bedroom Renovation",
    date: "Feb 15",
    due: "Mar 1",
    amount: 1200,
    status: "Paid",
  },
  {
    id: "INV-002",
    client: "Sarah Thompson",
    project: "Bedroom Renovation",
    date: "Mar 1",
    due: "Mar 15",
    amount: 1400,
    status: "Outstanding",
  },
  {
    id: "INV-003",
    client: "James Mitchell",
    project: "Kitchen Redesign",
    date: "Feb 20",
    due: "Mar 5",
    amount: 2500,
    status: "Outstanding",
  },
  {
    id: "INV-004",
    client: "Emma Richardson",
    project: "Media Wall",
    date: "Jan 10",
    due: "Jan 25",
    amount: 800,
    status: "Paid",
  },
  {
    id: "INV-005",
    client: "David Chen",
    project: "Walk-in Wardrobe",
    date: "Mar 1",
    due: "Mar 15",
    amount: 1800,
    status: "Draft",
  },
  {
    id: "INV-006",
    client: "Rachel Adams",
    project: "Full Home",
    date: "Dec 1",
    due: "Dec 15",
    amount: 5000,
    status: "Overdue",
  },
];

export function AdminInvoices() {
  usePageTitle("Invoices - Admin Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [createModal, setCreateModal] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<(typeof invoices)[0] | null>(
    null,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<(typeof invoices)[0] | null>(null);
  const [newInv, setNewInv] = useState({
    client: "",
    project: "",
    due: "",
  });
  const [newInvItems, setNewInvItems] = useState([
    { id: 1, name: "", qty: 1, price: "" },
  ]);
  const [newInvTax, setNewInvTax] = useState(20);

  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const acc = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";

  const paid = invoices
    .filter((i) => i.status === "Paid")
    .reduce((s, i) => s + i.amount, 0);
  const outstanding = invoices
    .filter((i) => i.status === "Outstanding")
    .reduce((s, i) => s + i.amount, 0);
  const overdue = invoices
    .filter((i) => i.status === "Overdue")
    .reduce((s, i) => s + i.amount, 0);

  const statusColor = (s: string) => {
    if (s === "Paid")
      return darkMode
        ? "bg-[#4A8C5C]/20 text-[#4A8C5C]"
        : "bg-[#1C4A3A]/10 text-[#1C4A3A]";
    if (s === "Outstanding") return "bg-amber-500/10 text-amber-500";
    if (s === "Overdue") return "bg-red-500/10 text-red-500";
    return darkMode
      ? "bg-[#2A2A28] text-[#8A8A82]"
      : "bg-[#EAE7E0] text-[#6B6B65]";
  };

  const handleSend = (id: string) => {
    setInvoices(
      invoices.map((i) => (i.id === id ? { ...i, status: "Outstanding" } : i)),
    );
    toast.success("Invoice sent to client!");
  };

  const handleMarkPaid = (id: string) => {
    setInvoices(
      invoices.map((i) => (i.id === id ? { ...i, status: "Paid" } : i)),
    );
    toast.success("Invoice marked as paid!");
  };

  const handleDownload = (id: string) => {
    window.print();
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const subtotal = newInvItems.reduce(
      (s, item) => s + Number(item.price) * item.qty,
      0,
    );
    const totalWithTax = subtotal * (1 + newInvTax / 100);
    const newId = `INV-${String(invoices.length + 1).padStart(3, "0")}`;
    setInvoices([
      ...invoices,
      {
        id: newId,
        client: newInv.client,
        project: newInv.project,
        date: new Date().toLocaleDateString("en-GB", {
          month: "short",
          day: "numeric",
        }),
        due: newInv.due,
        amount: Math.round(totalWithTax),
        status: "Draft",
      },
    ]);
    toast.success(`Invoice ${newId} created!`);
    setCreateModal(false);
    setNewInv({ client: "", project: "", due: "" });
    setNewInvItems([{ id: 1, name: "", qty: 1, price: "" }]);
    setNewInvTax(20);
  };

  const handleOpenEdit = (inv: (typeof invoices)[0]) => {
    setViewInvoice(inv);
    setEditForm({ ...inv });
    setIsEditing(true);
  };

  const handleEditClick = () => {
    if (viewInvoice) {
      setEditForm({ ...viewInvoice });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (editForm) {
      setInvoices(invoices.map((i) => (i.id === editForm.id ? editForm : i)));
      setViewInvoice(editForm);
      setIsEditing(false);
      toast.success("Invoice updated successfully!");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
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
          Invoices
        </motion.h1>
        <button
          onClick={() => setCreateModal(true)}
          className={`px-4 py-2 rounded-full text-[12px] text-white flex items-center gap-1 ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
        >
          <Plus size={12} /> Create Invoice
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Paid This Month",
            value: `\u00A3${paid.toLocaleString()}`,
            color: acc,
          },
          {
            label: "Outstanding",
            value: `\u00A3${outstanding.toLocaleString()}`,
            color: "text-amber-500",
          },
          {
            label: "Overdue",
            value: `\u00A3${overdue.toLocaleString()}`,
            color: "text-red-500",
          },
          {
            label: "Total Revenue",
            value: `\u00A3${(paid + outstanding).toLocaleString()}`,
            color: t1,
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`${c} border rounded-2xl p-5`}
          >
            <span className={`text-[11px] uppercase tracking-[0.2em] ${t2}`}>
              {s.label}
            </span>
            <p
              className={`mt-1 ${s.color}`}
              style={{ fontSize: "1.3rem", fontWeight: 600 }}
            >
              {s.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className={`${c} border rounded-2xl overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr
              className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
            >
              {["Invoice", "Client", "Amount", "Status", "Actions"].map((h) => (
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
            {invoices.map((inv, i) => (
              <tr
                key={inv.id}
                className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/10"} ${darkMode ? "hover:bg-[#2A2A28]/50" : "hover:bg-[#F5F4F0]"} transition-colors`}
              >
                <td className="px-4 py-3">
                  <p
                    className={`text-[13px] ${acc}`}
                    style={{ fontWeight: 500 }}
                  >
                    {inv.id}
                  </p>
                  <p className={`text-[11px] ${t2}`}>{inv.project}</p>
                </td>
                <td className={`px-4 py-3 text-[12px] ${t1}`}>{inv.client}</td>
                <td
                  className={`px-4 py-3 text-[13px] ${t1}`}
                  style={{ fontWeight: 500 }}
                >
                  &pound;{inv.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] ${statusColor(inv.status)}`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {inv.status === "Draft" && (
                      <button
                        onClick={() => handleSend(inv.id)}
                        className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#EAE7E0]"}`}
                        title="Send"
                      >
                        <Send size={14} className={acc} />
                      </button>
                    )}
                    {(inv.status === "Outstanding" ||
                      inv.status === "Overdue") && (
                      <button
                        onClick={() => handleMarkPaid(inv.id)}
                        className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#EAE7E0]"}`}
                        title="Mark Paid"
                      >
                        <Check size={14} className={acc} />
                      </button>
                    )}
                    <button
                      onClick={() => setViewInvoice(inv)}
                      className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#EAE7E0]"}`}
                      title="View"
                    >
                      <Eye size={14} className={t2} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(inv)}
                      className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#EAE7E0]"}`}
                      title="Edit"
                    >
                      <Edit2 size={14} className={acc} />
                    </button>
                    <button
                      onClick={() => handleDownload(inv.id)}
                      className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#EAE7E0]"}`}
                      title="Download"
                    >
                      <Download size={14} className={t2} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hidden Invoice Print Template */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            background: white !important;
            color: #1E1E1C !important;
          }
          @page { margin: 2cm; }
        }
      `}</style>
      {viewInvoice && (
        <div id="invoice-print" className="hidden print:block">
          <div
            style={{
              maxWidth: "800px",
              margin: "0 auto",
              padding: "40px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              color: "#1E1E1C",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "40px",
                borderBottom: "3px solid #1C4A3A",
                paddingBottom: "20px",
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: "32px",
                    fontWeight: "700",
                    color: "#1C4A3A",
                    margin: "0 0 8px 0",
                  }}
                >
                  Enzo Interiors
                </h1>
                <p style={{ fontSize: "13px", color: "#6B6B65", margin: "0" }}>
                  Bespoke Fitted Interiors
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <h2
                  style={{
                    fontSize: "28px",
                    fontWeight: "600",
                    color: "#1C4A3A",
                    margin: "0 0 8px 0",
                  }}
                >
                  INVOICE
                </h2>
                <p
                  style={{
                    fontSize: "15px",
                    color: "#1E1E1C",
                    margin: "0",
                    fontWeight: "500",
                  }}
                >
                  {viewInvoice.id}
                </p>
              </div>
            </div>

            {/* Info Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "40px",
                marginBottom: "40px",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#6B6B65",
                    margin: "0 0 8px 0",
                  }}
                >
                  Bill To
                </p>
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1E1E1C",
                    margin: "0 0 4px 0",
                  }}
                >
                  {viewInvoice.client}
                </p>
                <p style={{ fontSize: "13px", color: "#6B6B65", margin: "0" }}>
                  {viewInvoice.project}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#6B6B65" }}>
                    Invoice Date:{" "}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#1E1E1C",
                      fontWeight: "500",
                    }}
                  >
                    {viewInvoice.date}, 2026
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "#6B6B65" }}>
                    Due Date:{" "}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#1E1E1C",
                      fontWeight: "500",
                    }}
                  >
                    {viewInvoice.due}, 2026
                  </span>
                </div>
              </div>
            </div>

            {/* Services Table */}
            <table
              style={{
                width: "100%",
                marginBottom: "40px",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid #1C4A3A" }}>
                  <th
                    style={{
                      textAlign: "left",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#6B6B65",
                      padding: "12px 0",
                      fontWeight: "600",
                    }}
                  >
                    Description
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#6B6B65",
                      padding: "12px 0",
                      fontWeight: "600",
                    }}
                  >
                    Quantity
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#6B6B65",
                      padding: "12px 0",
                      fontWeight: "600",
                    }}
                  >
                    Rate
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#6B6B65",
                      padding: "12px 0",
                      fontWeight: "600",
                    }}
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                  <td
                    style={{
                      padding: "16px 0",
                      fontSize: "14px",
                      color: "#1E1E1C",
                    }}
                  >
                    <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                      {viewInvoice.project}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6B6B65" }}>
                      Design consultation and planning
                    </div>
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      fontSize: "14px",
                      color: "#1E1E1C",
                      padding: "16px 0",
                    }}
                  >
                    1
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontSize: "14px",
                      color: "#1E1E1C",
                      padding: "16px 0",
                    }}
                  >
                    £{(viewInvoice.amount * 0.3).toFixed(2)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#1E1E1C",
                      padding: "16px 0",
                    }}
                  >
                    £{(viewInvoice.amount * 0.3).toFixed(2)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
                  <td
                    style={{
                      padding: "16px 0",
                      fontSize: "14px",
                      color: "#1E1E1C",
                    }}
                  >
                    <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                      Materials & fixtures
                    </div>
                    <div style={{ fontSize: "12px", color: "#6B6B65" }}>
                      Premium fittings and components
                    </div>
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      fontSize: "14px",
                      color: "#1E1E1C",
                      padding: "16px 0",
                    }}
                  >
                    1
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontSize: "14px",
                      color: "#1E1E1C",
                      padding: "16px 0",
                    }}
                  >
                    £{(viewInvoice.amount * 0.45).toFixed(2)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#1E1E1C",
                      padding: "16px 0",
                    }}
                  >
                    £{(viewInvoice.amount * 0.45).toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "16px 0",
                      fontSize: "14px",
                      color: "#1E1E1C",
                    }}
                  >
                    <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                      Installation & finishing
                    </div>
                    <div style={{ fontSize: "12px", color: "#6B6B65" }}>
                      Professional fitting service
                    </div>
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      fontSize: "14px",
                      color: "#1E1E1C",
                      padding: "16px 0",
                    }}
                  >
                    1
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontSize: "14px",
                      color: "#1E1E1C",
                      padding: "16px 0",
                    }}
                  >
                    £{(viewInvoice.amount * 0.25).toFixed(2)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#1E1E1C",
                      padding: "16px 0",
                    }}
                  >
                    £{(viewInvoice.amount * 0.25).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Total Section */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "60px",
              }}
            >
              <div style={{ width: "300px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    fontSize: "14px",
                    borderBottom: "1px solid #E0E0E0",
                  }}
                >
                  <span style={{ color: "#6B6B65" }}>Subtotal</span>
                  <span style={{ color: "#1E1E1C", fontWeight: "500" }}>
                    £{viewInvoice.amount.toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    fontSize: "14px",
                    borderBottom: "1px solid #E0E0E0",
                  }}
                >
                  <span style={{ color: "#6B6B65" }}>VAT (20%)</span>
                  <span style={{ color: "#1E1E1C", fontWeight: "500" }}>
                    £{(viewInvoice.amount * 0.2).toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "16px 0",
                    fontSize: "18px",
                    fontWeight: "600",
                    borderTop: "2px solid #1C4A3A",
                    marginTop: "4px",
                  }}
                >
                  <span style={{ color: "#1C4A3A" }}>Total Due</span>
                  <span style={{ color: "#1C4A3A" }}>
                    £{(viewInvoice.amount * 1.2).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: "2px solid #E0E0E0",
                paddingTop: "20px",
                fontSize: "12px",
                color: "#6B6B65",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontWeight: "500",
                  color: "#1E1E1C",
                }}
              >
                Payment Terms:
              </p>
              <p style={{ margin: "0 0 16px 0" }}>
                Payment is due within 14 days of invoice date. Please reference
                invoice number when making payment.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "16px",
                  marginTop: "20px",
                }}
              >
                <div>
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      fontWeight: "500",
                      color: "#1E1E1C",
                    }}
                  >
                    Bank Details:
                  </p>
                  <p style={{ margin: "0" }}>
                    Sort: 12-34-56
                    <br />
                    Account: 12345678
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      fontWeight: "500",
                      color: "#1E1E1C",
                    }}
                  >
                    Contact:
                  </p>
                  <p style={{ margin: "0" }}>
                    hello@enzo-interiors.co.uk
                    <br />
                    +44 (0) 20 1234 5678
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      fontWeight: "500",
                      color: "#1E1E1C",
                    }}
                  >
                    Address:
                  </p>
                  <p style={{ margin: "0" }}>
                    123 Design Street
                    <br />
                    London, UK W1A 1AA
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      <AnimatePresence>
        {viewInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setViewInvoice(null)}
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
                  {viewInvoice.id}
                  {viewInvoice.status !== "Paid" && !isEditing && (
                    <button
                      onClick={handleEditClick}
                      className={`ml-3 px-3 py-1 text-[11px] rounded-full ${darkMode ? "bg-[#2A2A28] text-[#8A8A82] hover:text-[#F0EEE9]" : "bg-[#EAE7E0] text-[#6B6B65] hover:text-[#1C4A3A]"}`}
                    >
                      Edit
                    </button>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setViewInvoice(null);
                    setIsEditing(false);
                  }}
                >
                  <X size={18} className={t2} />
                </button>
              </div>

              {isEditing && editForm ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Client
                    </label>
                    <select
                      value={editForm.client}
                      onChange={(e) =>
                        setEditForm({ ...editForm, client: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    >
                      <option>Sarah Thompson</option>
                      <option>James Mitchell</option>
                      <option>Emma Richardson</option>
                      <option>David Chen</option>
                      <option>Priya Patel</option>
                      <option>Rachel Adams</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Project
                    </label>
                    <input
                      value={editForm.project}
                      onChange={(e) =>
                        setEditForm({ ...editForm, project: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Amount (£)
                      </label>
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            amount: Number(e.target.value),
                          })
                        }
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[12px] ${t2} block mb-1`}>
                        Due Date
                      </label>
                      <input
                        type="text"
                        value={editForm.due}
                        onChange={(e) =>
                          setEditForm({ ...editForm, due: e.target.value })
                        }
                        placeholder="e.g. Mar 15"
                        className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Status
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          status: e.target.value as typeof editForm.status,
                        })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Outstanding">Outstanding</option>
                      <option value="Overdue">Overdue</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveEdit}
                      className={`flex-1 py-2.5 rounded-full text-[13px] text-white ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className={`flex-1 py-2.5 rounded-full text-[13px] border ${darkMode ? "border-[#2A2A28] text-[#8A8A82]" : "border-[#C4B8A8] text-[#6B6B65]"}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  <div
                    className={`p-4 rounded-xl mb-4 ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
                  >
                    <div className="flex justify-between text-[13px] mb-2">
                      <span className={t2}>Client</span>
                      <span className={t1}>{viewInvoice.client}</span>
                    </div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span className={t2}>Project</span>
                      <span className={t1}>{viewInvoice.project}</span>
                    </div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span className={t2}>Date</span>
                      <span className={t1}>{viewInvoice.date}, 2026</span>
                    </div>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span className={t2}>Due</span>
                      <span className={t1}>{viewInvoice.due}, 2026</span>
                    </div>
                    <div
                      className="flex justify-between text-[15px] pt-2 border-t border-dashed"
                      style={{ borderColor: darkMode ? "#2A2A28" : "#C4B8A8" }}
                    >
                      <span className={t1} style={{ fontWeight: 600 }}>
                        Total
                      </span>
                      <span className={t1} style={{ fontWeight: 600 }}>
                        &pound;{viewInvoice.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {viewInvoice.status === "Draft" && (
                      <button
                        onClick={() => {
                          handleSend(viewInvoice.id);
                          setViewInvoice({
                            ...viewInvoice,
                            status: "Outstanding",
                          });
                        }}
                        className={`flex-1 py-2.5 rounded-full text-[13px] text-white ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                      >
                        Send to Client
                      </button>
                    )}
                    {(viewInvoice.status === "Outstanding" ||
                      viewInvoice.status === "Overdue") && (
                      <button
                        onClick={() => {
                          handleMarkPaid(viewInvoice.id);
                          setViewInvoice({ ...viewInvoice, status: "Paid" });
                        }}
                        className={`flex-1 py-2.5 rounded-full text-[13px] text-white ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                      >
                        Mark as Paid
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(viewInvoice.id)}
                      className={`flex-1 py-2.5 rounded-full text-[13px] border ${darkMode ? "border-[#2A2A28] text-[#8A8A82]" : "border-[#C4B8A8] text-[#6B6B65]"}`}
                    >
                      Download PDF
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Invoice Modal */}
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
              className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                  Create Invoice
                </h3>
                <button onClick={() => setCreateModal(false)}>
                  <X size={18} className={t2} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-5">
                {/* Client & Project */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Client
                    </label>
                    <select
                      required
                      value={newInv.client}
                      onChange={(e) =>
                        setNewInv({ ...newInv, client: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    >
                      <option value="">Select client...</option>
                      <option>Sarah Thompson</option>
                      <option>James Mitchell</option>
                      <option>Emma Richardson</option>
                      <option>David Chen</option>
                      <option>Priya Patel</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Project
                    </label>
                    <input
                      required
                      value={newInv.project}
                      onChange={(e) =>
                        setNewInv({ ...newInv, project: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                      placeholder="Project name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Due Date
                    </label>
                    <input
                      required
                      type="date"
                      value={newInv.due}
                      onChange={(e) =>
                        setNewInv({ ...newInv, due: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      VAT / Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newInvTax}
                      onChange={(e) => setNewInvTax(Number(e.target.value))}
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C]"}`}
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <label className={`text-[12px] ${t2} block mb-2`}>
                    Line Items
                  </label>
                  <div
                    className={`rounded-xl border overflow-hidden ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/40"}`}
                  >
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr
                          className={`border-b ${darkMode ? "border-[#2A2A28] bg-[#2A2A28]/50" : "border-[#C4B8A8]/20 bg-[#F5F4F0]"}`}
                        >
                          <th className={`text-left px-3 py-2 ${t2}`}>
                            Item Name
                          </th>
                          <th className={`text-center px-3 py-2 w-16 ${t2}`}>
                            Qty
                          </th>
                          <th className={`text-right px-3 py-2 w-28 ${t2}`}>
                            Price (£)
                          </th>
                          <th className={`text-right px-3 py-2 w-24 ${t2}`}>
                            Subtotal
                          </th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {newInvItems.map((item) => (
                          <tr
                            key={item.id}
                            className={`border-b last:border-0 ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                          >
                            <td className="px-3 py-2">
                              <input
                                required
                                value={item.name}
                                onChange={(e) =>
                                  setNewInvItems(
                                    newInvItems.map((it) =>
                                      it.id === item.id
                                        ? { ...it, name: e.target.value }
                                        : it,
                                    ),
                                  )
                                }
                                placeholder="e.g. Design consultation"
                                className={`w-full px-2 py-1.5 rounded-lg border text-[12px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9] placeholder-[#8A8A82]" : "bg-white border-[#C4B8A8] text-[#2C2C2C] placeholder-[#C4B8A8]"}`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) =>
                                  setNewInvItems(
                                    newInvItems.map((it) =>
                                      it.id === item.id
                                        ? {
                                            ...it,
                                            qty: Number(e.target.value),
                                          }
                                        : it,
                                    ),
                                  )
                                }
                                className={`w-full px-2 py-1.5 rounded-lg border text-[12px] text-center focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9]" : "bg-white border-[#C4B8A8] text-[#2C2C2C]"}`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(e) =>
                                  setNewInvItems(
                                    newInvItems.map((it) =>
                                      it.id === item.id
                                        ? { ...it, price: e.target.value }
                                        : it,
                                    ),
                                  )
                                }
                                placeholder="0.00"
                                className={`w-full px-2 py-1.5 rounded-lg border text-[12px] text-right focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9] placeholder-[#8A8A82]" : "bg-white border-[#C4B8A8] text-[#2C2C2C] placeholder-[#C4B8A8]"}`}
                              />
                            </td>
                            <td
                              className={`px-3 py-2 text-right whitespace-nowrap ${t1}`}
                            >
                              £{(Number(item.price) * item.qty).toFixed(2)}
                            </td>
                            <td className="px-2 py-2">
                              {newInvItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNewInvItems(
                                      newInvItems.filter(
                                        (it) => it.id !== item.id,
                                      ),
                                    )
                                  }
                                  className="text-red-400 hover:text-red-500"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNewInvItems([
                        ...newInvItems,
                        {
                          id: Date.now(),
                          name: "",
                          qty: 1,
                          price: "",
                        },
                      ])
                    }
                    className={`mt-2 flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-lg ${darkMode ? "text-[#4A8C5C] hover:bg-[#4A8C5C]/10" : "text-[#1C4A3A] hover:bg-[#1C4A3A]/5"}`}
                  >
                    <Plus size={12} /> Add Item
                  </button>
                </div>

                {/* Totals */}
                <div
                  className={`rounded-xl p-4 space-y-2 ${darkMode ? "bg-[#2A2A28]/50" : "bg-[#F5F4F0]"}`}
                >
                  {(() => {
                    const subtotal = newInvItems.reduce(
                      (s, item) => s + Number(item.price) * item.qty,
                      0,
                    );
                    const vatAmount = subtotal * (newInvTax / 100);
                    const total = subtotal + vatAmount;
                    return (
                      <>
                        <div className="flex justify-between text-[13px]">
                          <span className={t2}>Subtotal</span>
                          <span className={t1}>£{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span className={t2}>VAT ({newInvTax}%)</span>
                          <span className={t1}>£{vatAmount.toFixed(2)}</span>
                        </div>
                        <div
                          className={`flex justify-between text-[15px] pt-2 border-t ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/40"}`}
                        >
                          <span className={t1} style={{ fontWeight: 600 }}>
                            Total
                          </span>
                          <span className={acc} style={{ fontWeight: 600 }}>
                            £{total.toFixed(2)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <button
                  type="submit"
                  className={`w-full py-3 rounded-full text-[14px] text-white ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
                >
                  Create as Draft
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
