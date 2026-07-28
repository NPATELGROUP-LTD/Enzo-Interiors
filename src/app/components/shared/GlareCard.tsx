import { useRef, useState } from "react";
import { motion } from "motion/react";

interface GlareCardProps {
  image: string;
  title: string;
  description: string;
  category: string;
  onClick?: () => void;
}

export function GlareCard({ image, title, description, category, onClick }: GlareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setRotateX((y - 0.5) * -12);
    setRotateY((x - 0.5) * 12);
    setGlarePos({ x: x * 100, y: y * 100 });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className="relative rounded-[20px] bg-[#FAFAF7] overflow-hidden cursor-pointer group"
      style={{
        transformStyle: "preserve-3d",
        perspective: 1000,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
      animate={{
        rotateX,
        rotateY,
        scale: isHovered ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Image */}
      <div className="relative h-56 md:h-64 overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-6">
        <span className="text-[#8A9E8C] text-[11px] uppercase tracking-[0.2em]">{category}</span>
        <h3 className="text-[#1C4A3A] mt-1" style={{ fontSize: "1.4rem" }}>{title}</h3>
        <p className="text-[#6B6B65] text-[14px] mt-2 leading-relaxed">{description}</p>
        <span className="inline-block mt-4 text-[#8A9E8C] text-[13px] group-hover:text-[#1C4A3A] transition-colors duration-300">
          Explore &rarr;
        </span>
      </div>

      {/* Glare effect */}
      {isHovered && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.25) 0%, transparent 60%)`,
          }}
        />
      )}
    </motion.div>
  );
}
