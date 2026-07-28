import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { MoveLeft, Home } from "lucide-react";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left - Dark with animated silhouette */}
      <div className="md:w-1/2 bg-[#1E1E1C] flex items-center justify-center p-12 min-h-[40vh] md:min-h-screen relative overflow-hidden">
        {/* Animated geometric lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" viewBox="0 0 600 600">
          <motion.circle cx="300" cy="300" r="200" stroke="#F2F0EB" strokeWidth="0.5" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 3, ease: "easeInOut" }} />
          <motion.circle cx="300" cy="300" r="250" stroke="#F2F0EB" strokeWidth="0.3" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 3, delay: 0.5, ease: "easeInOut" }} />
          <motion.rect x="150" y="150" width="300" height="300" stroke="#F2F0EB" strokeWidth="0.3" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 3, delay: 1, ease: "easeInOut" }} />
          <motion.line x1="100" y1="200" x2="500" y2="200" stroke="#F2F0EB" strokeWidth="0.3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 1.5 }} />
          <motion.line x1="100" y1="400" x2="500" y2="400" stroke="#F2F0EB" strokeWidth="0.3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay: 2 }} />
        </svg>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 text-center"
        >
          <span className="font-[Cormorant_Garamond] block" style={{ fontSize: "clamp(7rem, 18vw, 14rem)", fontWeight: 300, lineHeight: 0.9, color: "#1C4A3A" }}>
            404
          </span>
          <motion.div
            className="h-px bg-[#1C4A3A]/30 mx-auto mt-4"
            initial={{ width: 0 }}
            animate={{ width: "80%" }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </motion.div>
      </div>

      {/* Right - Cream with message */}
      <div className="md:w-1/2 bg-[#F2F0EB] flex items-center justify-center p-12 min-h-[60vh] md:min-h-screen">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md"
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-[#8A9E8C] text-[12px] uppercase tracking-[0.25em]"
          >
            Page Not Found
          </motion.span>
          <h2 className="text-[#1C4A3A] mt-4" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
            This room doesn't exist — yet.
          </h2>
          <p className="text-[#6B6B65] mt-4 text-[15px] leading-relaxed">
            The page you're looking for has been moved, deleted, or perhaps never existed. Let us help you find your way back to beautiful spaces.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#1C4A3A] text-[#1C4A3A] text-[14px] hover:bg-[#1C4A3A] hover:text-[#F2F0EB] transition-all duration-300"
            >
              <MoveLeft size={16} /> Go Back
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1C4A3A] text-[#F2F0EB] text-[14px] hover:bg-[#3D6347] transition-all duration-300 justify-center"
            >
              <Home size={16} /> Go Home
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-20"
          >
            <span className="font-[Cormorant_Garamond] italic text-[#C4B8A8]" style={{ fontSize: "1.1rem" }}>
              Enzo Interiors
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
