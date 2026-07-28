import { useState } from "react";
import { useOutletContext } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { X, CreditCard, Eye, Printer } from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";

const invoices = [
  {
    id: "INV-001",
    date: "Feb 15, 2026",
    description: "Bedroom Renovation - Deposit",
    amount: 1200,
    status: "Paid",
  },
  {
    id: "INV-002",
    date: "Mar 1, 2026",
    description: "Bedroom Renovation - Design Phase",
    amount: 1400,
    status: "Outstanding",
  },
  {
    id: "INV-003",
    date: "Mar 15, 2026",
    description: "Bedroom Renovation - Manufacturing",
    amount: 1000,
    status: "Outstanding",
  },
];

export function PortalInvoices() {
  usePageTitle("Invoices - Client Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [payModal, setPayModal] = useState<(typeof invoices)[0] | null>(null);
  const [viewInvoice, setViewInvoice] = useState<(typeof invoices)[0] | null>(
    null,
  );
  const [showViewModal, setShowViewModal] = useState(false);

  const cardBg = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const textPrimary = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const textSecondary = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const accent = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";

  const totalPaid = invoices
    .filter((i) => i.status === "Paid")
    .reduce((s, i) => s + i.amount, 0);
  const totalOutstanding = invoices
    .filter((i) => i.status === "Outstanding")
    .reduce((s, i) => s + i.amount, 0);

  const handleDownload = (invoice: (typeof invoices)[0]) => {
    setViewInvoice(invoice);
    setTimeout(() => window.print(), 100);
  };

  const handleView = (invoice: (typeof invoices)[0]) => {
    setViewInvoice(invoice);
    setShowViewModal(true);
  };

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${textPrimary} mb-8`}
        style={{ fontSize: "1.8rem" }}
      >
        Invoices & Payments
      </motion.h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <span
            className={`text-[11px] uppercase tracking-[0.2em] ${textSecondary}`}
          >
            Total Paid
          </span>
          <p
            className={`mt-1 ${accent}`}
            style={{ fontSize: "1.5rem", fontWeight: 600 }}
          >
            &pound;{totalPaid.toLocaleString()}
          </p>
        </div>
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <span
            className={`text-[11px] uppercase tracking-[0.2em] ${textSecondary}`}
          >
            Outstanding
          </span>
          <p
            className="text-amber-500 mt-1"
            style={{ fontSize: "1.5rem", fontWeight: 600 }}
          >
            &pound;{totalOutstanding.toLocaleString()}
          </p>
        </div>
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <span
            className={`text-[11px] uppercase tracking-[0.2em] ${textSecondary}`}
          >
            Next Due
          </span>
          <p
            className={`mt-1 ${textPrimary}`}
            style={{ fontSize: "1.5rem", fontWeight: 600 }}
          >
            Mar 15
          </p>
        </div>
      </div>

      {/* Invoice Table */}
      <div className={`${cardBg} border rounded-2xl overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr
              className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
            >
              <th
                className={`text-left text-[11px] uppercase tracking-wider ${textSecondary} px-5 py-4 w-28`}
              >
                Invoice
              </th>
              <th
                className={`text-left text-[11px] uppercase tracking-wider ${textSecondary} px-5 py-4`}
              >
                Description
              </th>
              <th
                className={`text-right text-[11px] uppercase tracking-wider ${textSecondary} px-5 py-4 w-28 hidden sm:table-cell`}
              >
                Amount
              </th>
              <th
                className={`text-center text-[11px] uppercase tracking-wider ${textSecondary} px-5 py-4 w-28 hidden sm:table-cell`}
              >
                Status
              </th>
              <th
                className={`text-right text-[11px] uppercase tracking-wider ${textSecondary} px-5 py-4 w-36`}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <motion.tr
                key={inv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`border-b last:border-0 ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"} ${i % 2 !== 0 ? (darkMode ? "bg-[#1E1E1C]" : "bg-[#FAFAF8]") : ""}`}
              >
                <td
                  className={`px-5 py-4 text-[13px] ${accent} whitespace-nowrap`}
                  style={{ fontWeight: 500 }}
                >
                  {inv.id}
                </td>
                <td className="px-5 py-4">
                  <p className={`text-[13px] ${textPrimary}`}>
                    {inv.description}
                  </p>
                  <p className={`text-[11px] ${textSecondary} sm:hidden`}>
                    &pound;{inv.amount.toLocaleString()}
                  </p>
                </td>
                <td
                  className={`px-5 py-4 text-[13px] ${textPrimary} text-right whitespace-nowrap hidden sm:table-cell`}
                >
                  &pound;{inv.amount.toLocaleString()}
                </td>
                <td className="px-5 py-4 text-center hidden sm:table-cell">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-[11px] whitespace-nowrap ${
                      inv.status === "Paid"
                        ? darkMode
                          ? "bg-[#4A8C5C]/20 text-[#4A8C5C]"
                          : "bg-[#1C4A3A]/10 text-[#1C4A3A]"
                        : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleView(inv)}
                      className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28] text-[#8A8A82]" : "hover:bg-[#F5F4F0] text-[#6B6B65]"} transition-colors`}
                      title="View Invoice"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => handleDownload(inv)}
                      className={`p-1.5 rounded-lg ${darkMode ? "hover:bg-[#2A2A28] text-[#8A8A82]" : "hover:bg-[#F5F4F0] text-[#6B6B65]"} transition-colors`}
                      title="Print / PDF"
                    >
                      <Printer size={15} />
                    </button>
                    {inv.status === "Outstanding" && (
                      <button
                        onClick={() => setPayModal(inv)}
                        className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"}`}
                      >
                        Pay
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Invoice Modal */}
      <AnimatePresence>
        {showViewModal && viewInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowViewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`${darkMode ? "bg-[#1C1C1A] border border-[#2A2A28]" : "bg-white border border-[#C4B8A8]/20"} rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3
                    className={textPrimary}
                    style={{ fontSize: "1.3rem", fontWeight: 600 }}
                  >
                    {viewInvoice.id}
                  </h3>
                  <p className={`text-[12px] ${textSecondary} mt-1`}>
                    {viewInvoice.date}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] ${
                      viewInvoice.status === "Paid"
                        ? darkMode
                          ? "bg-[#4A8C5C]/20 text-[#4A8C5C]"
                          : "bg-[#1C4A3A]/10 text-[#1C4A3A]"
                        : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {viewInvoice.status}
                  </span>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className={`p-1 rounded-full ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
                  >
                    <X size={18} className={textSecondary} />
                  </button>
                </div>
              </div>

              <div
                className={`rounded-xl p-4 mb-6 ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
              >
                <p
                  className={`text-[13px] ${textPrimary} mb-1`}
                  style={{ fontWeight: 500 }}
                >
                  {viewInvoice.description}
                </p>
                <p className={`text-[12px] ${textSecondary}`}>
                  Professional design and consultation services
                </p>
              </div>

              <table className="w-full mb-6">
                <thead>
                  <tr
                    className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                  >
                    <th
                      className={`text-left text-[11px] uppercase tracking-wider ${textSecondary} pb-3`}
                    >
                      Item
                    </th>
                    <th
                      className={`text-center text-[11px] uppercase tracking-wider ${textSecondary} pb-3`}
                    >
                      Qty
                    </th>
                    <th
                      className={`text-right text-[11px] uppercase tracking-wider ${textSecondary} pb-3`}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { item: "Design & Consultation", qty: 1, pct: 0.35 },
                    { item: "Materials & Fixtures", qty: 1, pct: 0.4 },
                    { item: "Installation Service", qty: 1, pct: 0.25 },
                  ].map(({ item, qty, pct }) => (
                    <tr
                      key={item}
                      className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                    >
                      <td className={`py-3 text-[13px] ${textPrimary}`}>
                        {item}
                      </td>
                      <td
                        className={`py-3 text-[13px] ${textSecondary} text-center`}
                      >
                        {qty}
                      </td>
                      <td
                        className={`py-3 text-[13px] ${textPrimary} text-right`}
                      >
                        &pound;{(viewInvoice.amount * pct).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className={`text-[13px] ${textSecondary}`}>
                    Subtotal
                  </span>
                  <span className={`text-[13px] ${textPrimary}`}>
                    &pound;{viewInvoice.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-[13px] ${textSecondary}`}>
                    VAT (20%)
                  </span>
                  <span className={`text-[13px] ${textPrimary}`}>
                    &pound;{(viewInvoice.amount * 0.2).toFixed(2)}
                  </span>
                </div>
                <div
                  className={`flex justify-between pt-2 border-t ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                >
                  <span
                    className={`text-[14px] ${accent}`}
                    style={{ fontWeight: 600 }}
                  >
                    Total
                  </span>
                  <span
                    className={`text-[14px] ${accent}`}
                    style={{ fontWeight: 600 }}
                  >
                    &pound;{(viewInvoice.amount * 1.2).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleDownload(viewInvoice);
                  }}
                  className={`flex-1 px-4 py-3 rounded-full text-[13px] border ${darkMode ? "border-[#2A2A28] text-[#8A8A82] hover:bg-[#2A2A28]" : "border-[#C4B8A8] text-[#6B6B65] hover:bg-[#F5F4F0]"} transition-colors flex items-center justify-center gap-2`}
                >
                  <Printer size={14} /> Print / PDF
                </button>
                {viewInvoice.status === "Outstanding" && (
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setPayModal(viewInvoice);
                    }}
                    className={`flex-1 px-4 py-3 rounded-full text-[13px] ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"} hover:opacity-90 transition-opacity`}
                  >
                    Pay &pound;{(viewInvoice.amount * 1.2).toFixed(2)}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  Sarah Thompson
                </p>
                <p style={{ fontSize: "13px", color: "#6B6B65", margin: "0" }}>
                  {viewInvoice.description}
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
                    {viewInvoice.date}
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
                    Mar 15, 2026
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
                      {viewInvoice.description}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6B6B65" }}>
                      Professional design and consultation services
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
                    £{(viewInvoice.amount * 0.35).toFixed(2)}
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
                    £{(viewInvoice.amount * 0.35).toFixed(2)}
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
                      Premium quality components
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
                    £{(viewInvoice.amount * 0.4).toFixed(2)}
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
                    £{(viewInvoice.amount * 0.4).toFixed(2)}
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
                      Installation service
                    </div>
                    <div style={{ fontSize: "12px", color: "#6B6B65" }}>
                      Professional fitting and finishing
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

      {/* Pay Modal */}
      <AnimatePresence>
        {payModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPayModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-3xl p-8 max-w-md w-full`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={textPrimary} style={{ fontSize: "1.3rem" }}>
                  Pay Invoice
                </h3>
                <button
                  onClick={() => setPayModal(null)}
                  className={`p-1 rounded-full ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
                >
                  <X size={18} className={textSecondary} />
                </button>
              </div>

              <div
                className={`p-4 rounded-xl mb-6 ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
              >
                <div className="flex justify-between text-[13px]">
                  <span className={textSecondary}>{payModal.id}</span>
                  <span className={textPrimary} style={{ fontWeight: 600 }}>
                    &pound;{payModal.amount.toLocaleString()}
                  </span>
                </div>
                <p className={`text-[12px] ${textSecondary} mt-1`}>
                  {payModal.description}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`text-[12px] ${textSecondary} block mb-1`}>
                    Card Number
                  </label>
                  <div
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${darkMode ? "bg-[#2A2A28] border-[#2A2A28]" : "bg-[#F5F4F0] border-[#C4B8A8]"}`}
                  >
                    <CreditCard size={16} className={textSecondary} />
                    <input
                      placeholder="4242 4242 4242 4242"
                      className={`flex-1 bg-transparent text-[13px] focus:outline-none ${textPrimary}`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`text-[12px] ${textSecondary} block mb-1`}
                    >
                      Expiry
                    </label>
                    <input
                      placeholder="MM/YY"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28]" : "bg-[#F5F4F0] border-[#C4B8A8]"} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <label
                      className={`text-[12px] ${textSecondary} block mb-1`}
                    >
                      CVC
                    </label>
                    <input
                      placeholder="123"
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${darkMode ? "bg-[#2A2A28] border-[#2A2A28]" : "bg-[#F5F4F0] border-[#C4B8A8]"} ${textPrimary}`}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  toast.success(`Payment of £${payModal.amount} confirmed!`);
                  setPayModal(null);
                }}
                className={`w-full mt-6 px-8 py-3.5 rounded-full text-[14px] ${darkMode ? "bg-[#4A8C5C] text-white" : "bg-[#1C4A3A] text-white"} hover:opacity-90 transition-opacity`}
              >
                Pay &pound;{payModal.amount.toLocaleString()}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
