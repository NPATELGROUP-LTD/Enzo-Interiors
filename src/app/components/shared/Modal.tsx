import { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  darkMode?: boolean;
}

export function Modal({ open, onClose, title, children, size = "md", darkMode = false }: ModalProps) {
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
    full: "max-w-[95vw] max-h-[95vh]",
  };

  const bg = darkMode ? "bg-[#1C1C1A]" : "bg-white";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`${bg} rounded-2xl ${sizeClasses[size]} w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}>
                <h3 className={t1} style={{ fontSize: "1.2rem" }}>{title}</h3>
                <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}>
                  <X size={18} className={t2} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
