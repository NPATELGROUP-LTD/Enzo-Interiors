import { useState } from "react";
import { Link } from "react-router";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { ScrollReveal } from "../shared/ScrollReveal";
import { SectionLabel } from "../shared/SectionLabel";

export function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent! We'll be in touch soon.");
    setForm({ name: "", email: "", phone: "", service: "", message: "" });
  };

  return (
    <div>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-[#F2F0EB]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <p className="text-[#8A9E8C] text-[12px] uppercase tracking-[0.2em] mb-4">
            <Link to="/" className="hover:text-[#1C4A3A] transition-colors">Home</Link> / Contact
          </p>
          <h1 className="text-[#1C4A3A]" style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}>Get In Touch</h1>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 pb-24 bg-[#F2F0EB]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row gap-12">
            {/* Map */}
            <ScrollReveal className="md:w-[55%]">
              <div className="rounded-2xl overflow-hidden h-[400px] md:h-[600px] bg-[#EAE7E0]">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d77614.84573752053!2d-1.1900!3d52.6369!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4877614740de1dbf%3A0x1e2e20d8e2d2a9f9!2sLeicester!5e0!3m2!1sen!2suk!4v1700000000000"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: "saturate(0.5) sepia(0.2)" }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Enzo Interiors Location"
                />
              </div>
            </ScrollReveal>

            {/* Contact Form */}
            <ScrollReveal className="md:w-[45%]" delay={0.15}>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-[#2C2C2C] text-[13px] block mb-2">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[#2C2C2C] text-[14px] focus:outline-none focus:border-[#1C4A3A] focus:bg-white transition-all duration-300"
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <label className="text-[#2C2C2C] text-[13px] block mb-2">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[#2C2C2C] text-[14px] focus:outline-none focus:border-[#1C4A3A] focus:bg-white transition-all duration-300"
                    placeholder="you@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="text-[#2C2C2C] text-[13px] block mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[#2C2C2C] text-[14px] focus:outline-none focus:border-[#1C4A3A] focus:bg-white transition-all duration-300"
                    placeholder="07XXX XXXXXX"
                  />
                </div>
                <div>
                  <label className="text-[#2C2C2C] text-[13px] block mb-2">Service Interested In</label>
                  <select
                    value={form.service}
                    onChange={(e) => setForm({ ...form, service: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[#2C2C2C] text-[14px] focus:outline-none focus:border-[#1C4A3A] focus:bg-white transition-all duration-300"
                  >
                    <option value="">Select a service...</option>
                    <option value="kitchen">Bespoke Kitchen</option>
                    <option value="bedroom">Fitted Bedroom</option>
                    <option value="media">Media Wall</option>
                    <option value="wardrobe">Fitted Wardrobe</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#2C2C2C] text-[13px] block mb-2">Message</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl bg-[#F5F4F0] border border-[#C4B8A8] text-[#2C2C2C] text-[14px] focus:outline-none focus:border-[#1C4A3A] focus:bg-white transition-all duration-300 resize-none"
                    placeholder="Tell us about your project..."
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-8 py-3.5 rounded-full bg-[#1C4A3A] text-[#F2F0EB] text-[14px] tracking-wide hover:bg-[#3D6347] transition-all duration-300 hover:-translate-y-0.5"
                >
                  Send Message
                </button>
              </form>

              {/* Contact Details */}
              <div className="mt-10 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#1C4A3A]/10 flex items-center justify-center flex-shrink-0">
                    <Phone size={16} className="text-[#1C4A3A]" />
                  </div>
                  <span className="text-[#2C2C2C] text-[14px]">0116 XXX XXXX</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#1C4A3A]/10 flex items-center justify-center flex-shrink-0">
                    <Mail size={16} className="text-[#1C4A3A]" />
                  </div>
                  <span className="text-[#2C2C2C] text-[14px]">hello@enzointeriors.co.uk</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#1C4A3A]/10 flex items-center justify-center flex-shrink-0">
                    <MapPin size={16} className="text-[#1C4A3A]" />
                  </div>
                  <span className="text-[#2C2C2C] text-[14px]">Leicester & Leicestershire</span>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* WhatsApp Strip */}
          <ScrollReveal className="mt-16">
            <div className="bg-[#1C4A3A] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <MessageCircle size={28} className="text-white" />
                <div>
                  <p className="text-white text-[16px]" style={{ fontWeight: 500 }}>Prefer to chat?</p>
                  <p className="text-[#8A9E8C] text-[14px]">Message us directly on WhatsApp</p>
                </div>
              </div>
              <a
                href="#"
                className="px-8 py-3 rounded-full bg-white text-[#1C4A3A] text-[14px] tracking-wide hover:bg-[#F2F0EB] transition-all duration-300"
              >
                Chat on WhatsApp
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
