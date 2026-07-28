import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Search,
  File,
  User,
  DollarSign,
  MessageCircle,
  Calendar,
  Star,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router";
import { searchData, SearchResult } from "../../data/mockData";

interface CommandPaletteProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const typeIcons = {
  client: User,
  project: File,
  invoice: DollarSign,
  message: MessageCircle,
  booking: Calendar,
  testimonial: Star,
};

const typeColors = {
  client: "text-blue-500",
  project: "text-green-500",
  invoice: "text-amber-500",
  message: "text-purple-500",
  booking: "text-pink-500",
  testimonial: "text-yellow-500",
};

export function CommandPalette({
  darkMode,
  isOpen,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const hover = darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]";
  const selected = darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]";

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Update results when query changes
  useEffect(() => {
    if (query.trim()) {
      const searchResults = searchData(query);
      setResults(searchResults.slice(0, 8)); // Limit to 8 results
      setSelectedIndex(0);
    } else {
      setResults([]);
      setSelectedIndex(0);
    }
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-start justify-center pt-[15vh] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`${c} border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div
            className={`flex items-center gap-3 px-5 py-4 border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
          >
            <Search size={20} className={t2} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients, projects, invoices, messages..."
              className={`flex-1 bg-transparent text-[15px] focus:outline-none ${t1} placeholder:${t2}`}
            />
            <button onClick={onClose} className={`p-1 rounded-lg ${hover}`}>
              <X size={18} className={t2} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {query.trim() && results.length === 0 && (
              <div className="p-8 text-center">
                <p className={`text-[14px] ${t2}`}>
                  No results found for "{query}"
                </p>
              </div>
            )}

            {results.length > 0 && (
              <div className="py-2">
                {results.map((result, index) => {
                  const Icon = typeIcons[result.type as keyof typeof typeIcons];
                  const iconColor =
                    typeColors[result.type as keyof typeof typeColors];
                  const isSelected = index === selectedIndex;

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${
                        isSelected ? selected : hover
                      }`}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className={`flex-shrink-0 ${iconColor}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] ${t1} font-medium truncate`}>
                          {result.title}
                        </p>
                        {result.subtitle && (
                          <p className={`text-[12px] ${t2} truncate`}>
                            {result.subtitle}
                          </p>
                        )}
                        {result.description && (
                          <p className={`text-[11px] ${t2} truncate mt-0.5`}>
                            {result.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={16} className={t2} />
                    </button>
                  );
                })}
              </div>
            )}

            {!query.trim() && (
              <div className="p-8 text-center">
                <Search size={40} className={`${t2} mx-auto mb-3 opacity-50`} />
                <p className={`text-[14px] ${t1} font-medium mb-1`}>
                  Quick Search
                </p>
                <p className={`text-[12px] ${t2}`}>
                  Search for clients, projects, invoices, messages, bookings,
                  and more...
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <kbd
                    className={`px-2 py-1 rounded text-[11px] ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"} ${t2} font-mono`}
                  >
                    ↑↓
                  </kbd>
                  <span className={`text-[11px] ${t2}`}>Navigate</span>
                  <kbd
                    className={`px-2 py-1 rounded text-[11px] ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"} ${t2} font-mono ml-2`}
                  >
                    Enter
                  </kbd>
                  <span className={`text-[11px] ${t2}`}>Select</span>
                  <kbd
                    className={`px-2 py-1 rounded text-[11px] ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"} ${t2} font-mono ml-2`}
                  >
                    Esc
                  </kbd>
                  <span className={`text-[11px] ${t2}`}>Close</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
