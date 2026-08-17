"use client";

// Split out of AboutPage.tsx during the port: this section draws to a
// <canvas> via a mouse-reactive particle simulation (useRef/useEffect +
// direct DOM/canvas APIs), so it must be a Client Component. Everything
// else on the About page is static and stays server-rendered in page.tsx.
import { useEffect, useRef } from "react";

export function ParticleTextSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const particles: {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      vx: number;
      vy: number;
    }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
      initParticles();
    };

    const initParticles = () => {
      particles.length = 0;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.fillStyle = "#F2F0EB";
      ctx.font = `bold ${Math.min(w / 8, 80)}px 'Fraunces', serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ENZO INTERIORS", w / 2, h / 2);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const step = 4;

      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const i = (y * canvas.width + x) * 4;
          if ((imageData.data[i + 3] ?? 0) > 128) {
            particles.push({
              x: x / 2,
              y: y / 2,
              baseX: x / 2,
              baseY: y / 2,
              size: 1.5,
              vx: 0,
              vy: 0,
            });
          }
        }
      }
    };

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      ctx.fillStyle = "#8A9E8C";

      for (const p of particles) {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = Math.max(0, 80 - dist) / 80;

        if (force > 0) {
          p.vx -= (dx / dist) * force * 3;
          p.vy -= (dy / dist) * force * 3;
        }

        p.vx += (p.baseX - p.x) * 0.05;
        p.vy += (p.baseY - p.y) * 0.05;
        p.vx *= 0.85;
        p.vy *= 0.85;
        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };

    resize();
    animate();

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    };
    window.addEventListener("resize", debouncedResize);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <section className="bg-enzo-forest py-12">
      <canvas
        ref={canvasRef}
        className="w-full h-[250px] md:h-[350px] cursor-crosshair"
      />
    </section>
  );
}
