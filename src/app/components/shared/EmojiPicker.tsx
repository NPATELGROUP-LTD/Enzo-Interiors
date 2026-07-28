import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search } from "lucide-react";

const emojiCategories = {
  "Smileys & People": [
    "😀",
    "😁",
    "😂",
    "🤣",
    "😃",
    "😄",
    "😅",
    "😆",
    "😉",
    "😊",
    "😋",
    "😎",
    "😍",
    "😘",
    "🥰",
    "😗",
    "😙",
    "😚",
    "🙂",
    "🤗",
    "🤩",
    "🤔",
    "🤨",
    "😐",
    "😑",
    "😶",
    "🙄",
    "😏",
    "😣",
    "😥",
    "😮",
    "🤐",
    "😯",
    "😪",
    "😫",
    "🥱",
    "😴",
    "😌",
    "😛",
    "😜",
    "😝",
    "🤤",
    "😒",
    "😓",
    "😔",
    "😕",
    "🙃",
    "🤑",
    "😲",
    "🙁",
    "😖",
    "😞",
    "😟",
    "😤",
    "😢",
    "😭",
    "😦",
    "😧",
    "😨",
    "😩",
    "🤯",
    "😬",
    "😰",
    "😱",
    "🥵",
    "🥶",
    "😳",
    "🤪",
    "😵",
    "🥴",
    "😷",
    "🤒",
    "🤕",
    "🤢",
    "🤮",
    "🤧",
    "😇",
    "🥳",
    "🥺",
    "🤠",
    "🤡",
    "🤥",
    "🤫",
    "🤭",
    "🧐",
    "🤓",
    "👶",
    "👧",
    "🧒",
    "👦",
    "👩",
    "🧑",
    "👨",
    "👵",
    "🧓",
    "👴",
    "👨‍⚕️",
    "👩‍⚕️",
    "👨‍🎓",
    "👩‍🎓",
  ],
  "Animals & Nature": [
    "🐶",
    "🐱",
    "🐭",
    "🐹",
    "🐰",
    "🦊",
    "🐻",
    "🐼",
    "🐻‍❄️",
    "🐨",
    "🐯",
    "🦁",
    "🐮",
    "🐷",
    "🐸",
    "🐵",
    "🙈",
    "🙉",
    "🙊",
    "🐒",
    "🐔",
    "🐧",
    "🐦",
    "🐤",
    "🐣",
    "🐥",
    "🦆",
    "🦅",
    "🦉",
    "🦇",
    "🐺",
    "🐗",
    "🐴",
    "🦄",
    "🐝",
    "🪱",
    "🐛",
    "🦋",
    "🐌",
    "🐞",
    "🐜",
    "🪰",
    "🪲",
    "🪳",
    "🦟",
    "🦗",
    "🕷️",
    "🕸️",
    "🦂",
    "🐢",
    "🐍",
    "🦎",
    "🦖",
    "🦕",
    "🐙",
    "🦑",
    "🦐",
    "🦞",
    "🦀",
    "🐡",
    "🐠",
    "🐟",
    "🐬",
    "🐳",
    "🐋",
    "🦈",
    "🐊",
    "🐅",
    "🐆",
    "🦓",
  ],
  "Food & Drink": [
    "🍎",
    "🍊",
    "🍋",
    "🍌",
    "🍉",
    "🍇",
    "🍓",
    "🫐",
    "🍈",
    "🍒",
    "🍑",
    "🥭",
    "🍍",
    "🥥",
    "🥝",
    "🍅",
    "🍆",
    "🥑",
    "🥦",
    "🥬",
    "🥒",
    "🌶️",
    "🫑",
    "🌽",
    "🥕",
    "🫒",
    "🧄",
    "🧅",
    "🥔",
    "🍠",
    "🥐",
    "🍞",
    "🥖",
    "🥨",
    "🧀",
    "🥚",
    "🍳",
    "🧈",
    "🥞",
    "🧇",
    "🥓",
    "🥩",
    "🍗",
    "🍖",
    "🌭",
    "🍔",
    "🍟",
    "🍕",
    "🥪",
    "🥙",
    "🧆",
    "🌮",
    "🌯",
    "🫔",
    "🥗",
    "🥘",
    "🫕",
    "🥫",
    "🍝",
    "🍜",
    "🍲",
    "🍛",
    "🍣",
    "🍱",
    "🥟",
    "🦪",
    "🍤",
    "🍙",
    "🍚",
    "🍘",
  ],
  Activities: [
    "⚽",
    "🏀",
    "🏈",
    "⚾",
    "🥎",
    "🎾",
    "🏐",
    "🏉",
    "🥏",
    "🎱",
    "🪀",
    "🏓",
    "🏸",
    "🏒",
    "🏑",
    "🥍",
    "🏏",
    "🪃",
    "🥅",
    "⛳",
    "🪁",
    "🏹",
    "🎣",
    "🤿",
    "🥊",
    "🥋",
    "🎽",
    "🛹",
    "🛼",
    "🛷",
    "⛸️",
    "🥌",
    "🎿",
    "🎯",
    "🪀",
    "🎮",
    "🕹️",
    "🎰",
    "🎲",
    "🧩",
    "🎨",
    "🎭",
    "🎪",
    "🎤",
    "📺",
    "🎬",
    "🎸",
    "🎹",
    "🎼",
    "🎵",
    "🎶",
    "🎉",
    "🎊",
    "🎈",
    "🎀",
    "🎁",
    "🃏",
    "🀄",
    "🎴",
  ],
  Objects: [
    "💎",
    "🔮",
    "💈",
    "⚗️",
    "🔭",
    "🔬",
    "🕳️",
    "🩻",
    "💊",
    "💉",
    "🩹",
    "🩺",
    "🌡️",
    "🧹",
    "🧺",
    "🧻",
    "🚽",
    "🚿",
    "🛁",
    "🪒",
    "🧴",
    "🧷",
    "🧸",
    "🧿",
    "🎈",
    "🎏",
    "🎐",
    "🧧",
    "🎁",
    "🎀",
    "🎊",
    "🎉",
    "📱",
    "📞",
    "☎️",
    "📟",
    "📠",
    "🔋",
    "🪫",
    "🔌",
    "💻",
    "🖥️",
    "🖨️",
    "⌨️",
    "🖱️",
    "🖲️",
    "💽",
    "💾",
    "💿",
    "📀",
  ],
  Symbols: [
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "🤎",
    "💔",
    "❣️",
    "💕",
    "💞",
    "💓",
    "💗",
    "💖",
    "💘",
    "💝",
    "💟",
    "☮️",
    "✝️",
    "☪️",
    "🕎",
    "🔯",
    "🕉️",
    "☸️",
    "✡️",
    "🔱",
    "☦️",
    "🛐",
    "⚛️",
    "🉑",
    "☢️",
    "☣️",
    "📴",
    "📳",
    "🈶",
    "🈚",
    "🈸",
    "🈺",
    "🈷️",
    "✴️",
    "🆚",
    "💮",
    "🉐",
    "㊙️",
    "㊗️",
    "🈴",
    "🈵",
    "🈹",
    "🈲",
    "🅰️",
    "🅱️",
    "🆎",
    "🆑",
    "🅾️",
    "🆘",
    "❌",
    "⭕",
    "🛑",
  ],
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export function EmojiPicker({
  onEmojiSelect,
  isOpen,
  onClose,
  darkMode,
}: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState("Smileys & People");
  const [searchQuery, setSearchQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    onClose();
  };

  const filteredEmojis = searchQuery
    ? Object.values(emojiCategories)
        .flat()
        .filter(
          (emoji) => emoji.includes(searchQuery), // Simple search - could be enhanced with emoji names
        )
    : emojiCategories[activeCategory as keyof typeof emojiCategories];

  const cardBg = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const textPrimary = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const textSecondary = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const hoverBg = darkMode ? "hover:bg-[#2A2A28]" : "hover:bg-[#F5F4F0]";
  const activeBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={pickerRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className={`absolute bottom-full right-0 mb-2 w-80 h-96 ${cardBg} border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50`}
        >
          {/* Search */}
          <div className="p-4 border-b border-opacity-20">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
            >
              <Search size={16} className={textSecondary} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emojis..."
                className={`flex-1 bg-transparent text-[13px] focus:outline-none ${textPrimary} placeholder:${textSecondary}`}
              />
            </div>
          </div>

          {/* Categories */}
          {!searchQuery && (
            <div className="flex overflow-x-auto px-4 py-2 border-b border-opacity-20 scrollbar-hide">
              {Object.keys(emojiCategories).map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-medium rounded-full mr-2 transition-colors ${
                    activeCategory === category
                      ? `${activeBg} text-white`
                      : `${hoverBg} ${textSecondary}`
                  }`}
                >
                  {category.split(" ")[0]}
                </button>
              ))}
            </div>
          )}

          {/* Emoji Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-8 gap-1">
              {filteredEmojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  onClick={() => handleEmojiClick(emoji)}
                  className={`w-8 h-8 text-lg ${hoverBg} rounded-lg transition-colors flex items-center justify-center`}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
