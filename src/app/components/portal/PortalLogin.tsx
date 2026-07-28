import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { usePageTitle } from "../../hooks/usePageTitle";

const BG_IMG =
  "https://images.unsplash.com/photo-1765766601532-90e9b96320c8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBpbnRlcmlvciUyMGRlc2lnbiUyMGRhcmslMjBtb29keSUyMGtpdGNoZW58ZW58MXx8fHwxNzcyMzk4MjMzfDA&ixlib=rb-4.1.0&q=80&w=1080";

export function PortalLogin() {
  usePageTitle("Login - Client Portal");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("enzo_auth", "true");
    toast.success("Welcome back!");
    navigate("/portal/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left - Image Panel */}
      <div className="relative lg:w-[55%] min-h-[30vh] lg:min-h-screen">
        <ImageWithFallback
          src={BG_IMG}
          alt=""
          className="w-full h-full object-cover absolute inset-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
        <div className="relative z-10 h-full flex flex-col justify-between p-8 lg:p-12">
          <Link to="/">
            <span
              className="font-[Cormorant_Garamond] italic text-[#F2F0EB]"
              style={{ fontSize: "1.5rem", fontWeight: 600 }}
            >
              Enzo{" "}
              <span
                style={{
                  fontWeight: 300,
                  fontStyle: "normal",
                  fontSize: "0.75rem",
                  letterSpacing: "0.15em",
                }}
              >
                INTERIORS
              </span>
            </span>
          </Link>
          <div className="hidden lg:block">
            <h1
              className="text-[#F2F0EB] max-w-lg font-[Cormorant_Garamond]"
              style={{ fontSize: "2.5rem", lineHeight: 1.15, fontWeight: 400 }}
            >
              Your vision, beautifully realised.
            </h1>
            <p className="text-[#F2F0EB]/60 mt-4 text-[15px] max-w-md">
              Track your projects, view documents, and stay connected with the
              Enzo team.
            </p>
          </div>
          <div />
        </div>
      </div>

      {/* Right - Form Panel */}
      <div className="lg:w-[45%] bg-[#F2F0EB] flex items-center justify-center p-8 lg:p-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <h2
            className="text-[#1C4A3A] font-[Cormorant_Garamond]"
            style={{ fontSize: "2rem", fontWeight: 400 }}
          >
            Welcome Back
          </h2>
          <p className="text-[#6B6B65] mt-2 text-[14px]">
            Sign in to your client portal
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="text-[#2C2C2C] text-[13px] block mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[14px] focus:outline-none focus:border-[#1C4A3A] focus:bg-white transition-all"
                placeholder="you@email.com"
                required
              />
            </div>
            <div>
              <label className="text-[#2C2C2C] text-[13px] block mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[14px] focus:outline-none focus:border-[#1C4A3A] focus:bg-white transition-all"
                placeholder="Your password"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[#6B6B65] text-[13px] cursor-pointer">
                <input type="checkbox" className="rounded accent-[#1C4A3A]" />{" "}
                Remember me
              </label>
              <a
                href="#"
                className="text-[#1C4A3A] text-[13px] hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <button
              type="submit"
              className="w-full px-8 py-3.5 rounded-full bg-[#1C4A3A] text-[#F2F0EB] text-[14px] tracking-wide hover:bg-[#3D6347] transition-all duration-300"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#C4B8A8]" />
            <span className="text-[#8A9E8C] text-[12px]">or</span>
            <div className="h-px flex-1 bg-[#C4B8A8]" />
          </div>

          <button className="mt-6 w-full px-8 py-3 rounded-full border border-[#C4B8A8] text-[#2C2C2C] text-[14px] hover:border-[#1C4A3A] transition-all">
            Continue with magic link
          </button>

          {/* Quick access links */}
          <div className="mt-8 p-4 rounded-xl bg-[#FAFAF7] border border-[#C4B8A8]/30">
            <p className="text-[#8A9E8C] text-[11px] uppercase tracking-[0.15em] mb-3">
              Quick Access (Demo)
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to="/portal/dashboard"
                className="text-[#1C4A3A] text-[13px] hover:underline"
              >
                Client Portal &rarr;
              </Link>
              <Link
                to="/admin/dashboard"
                className="text-[#1C4A3A] text-[13px] hover:underline"
              >
                Admin Panel &rarr;
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-[#8A9E8C] text-[13px]">
            Don't have an account?{" "}
            <a href="#" className="text-[#1C4A3A] hover:underline">
              Contact us
            </a>
          </p>
        </motion.div>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}
