import { motion } from "motion/react";

interface Testimonial {
  text: string;
  name: string;
  role: string;
  image?: string;
}

interface TestimonialsColumnProps {
  testimonials: Testimonial[];
  duration?: number;
  className?: string;
  reverse?: boolean;
}

export function TestimonialsColumn({ testimonials, duration = 20, className = "", reverse = false }: TestimonialsColumnProps) {
  const doubled = [...testimonials, ...testimonials];

  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        className="flex flex-col gap-4"
        animate={{
          y: reverse ? ["-50%", "0%"] : ["0%", "-50%"],
        }}
        transition={{
          y: {
            duration,
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
          },
        }}
      >
        {doubled.map((t, i) => (
          <div
            key={`${t.name}-${i}`}
            className="bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)] break-inside-avoid"
          >
            <div className="flex gap-1 mb-3">
              {Array.from({ length: 5 }).map((_, si) => (
                <svg key={si} className="w-4 h-4 fill-amber-400 text-amber-400" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-[#2C2C2C] text-[14px] leading-relaxed">{t.text}</p>
            <div className="mt-4 flex items-center gap-3">
              {t.image && (
                <img src={t.image} alt={t.name} className="w-9 h-9 rounded-full object-cover" />
              )}
              <div>
                <p className="text-[#1C4A3A] text-[13px]" style={{ fontWeight: 600 }}>{t.name}</p>
                <p className="text-[#8A9E8C] text-[11px]">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
