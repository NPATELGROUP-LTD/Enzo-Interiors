import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  title: string;
  children: React.ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  darkMode,
  title,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  const bg = darkMode ? "bg-[#1C1C1A]" : "bg-white";
  const textPrimary = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const textSecondary = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] md:hidden"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed bottom-0 left-0 right-0 ${bg} rounded-t-3xl z-[70] md:hidden max-h-[80vh] overflow-hidden flex flex-col`}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div
                className={`w-10 h-1 rounded-full ${darkMode ? "bg-[#2A2A28]" : "bg-[#C4B8A8]/30"}`}
              />
            </div>

            {/* Header */}
            <div
              className={`flex items-center justify-between px-6 py-3 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
            >
              <h3 className={`text-[16px] font-semibold ${textPrimary}`}>
                {title}
              </h3>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg ${darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]"}`}
              >
                <X size={18} className={textSecondary} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
