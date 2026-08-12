"use client";

// Split out of ContactPage.tsx during the port: this is the only part of
// the Contact page with interactive state (local useState form + toast on
// submit), so it's the only piece that needs to be a Client Component.
// Keeps the boilerplate's pattern of local useState (no react-hook-form)
// and a mock submit handler — no real submission endpoint exists yet.
import { useState } from "react";
import { toast } from "sonner";

export function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    service: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent! We'll be in touch soon.");
    setForm({ name: "", email: "", phone: "", service: "", message: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-foreground text-[13px] block mb-2">
          Full Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-foreground text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all duration-300"
          placeholder="Your name"
          required
        />
      </div>
      <div>
        <label className="text-foreground text-[13px] block mb-2">
          Email Address
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-foreground text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all duration-300"
          placeholder="you@email.com"
          required
        />
      </div>
      <div>
        <label className="text-foreground text-[13px] block mb-2">
          Phone Number
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-foreground text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all duration-300"
          placeholder="07XXX XXXXXX"
        />
      </div>
      <div>
        <label className="text-foreground text-[13px] block mb-2">
          Service Interested In
        </label>
        <select
          value={form.service}
          onChange={(e) => setForm({ ...form, service: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-foreground text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all duration-300"
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
        <label className="text-foreground text-[13px] block mb-2">
          Message
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={5}
          className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-foreground text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all duration-300 resize-none"
          placeholder="Tell us about your project..."
          required
        />
      </div>
      <button
        type="submit"
        className="w-full px-8 py-3.5 rounded-full bg-primary text-primary-foreground text-[14px] tracking-wide hover:bg-enzo-forest-light transition-all duration-300 hover:-translate-y-0.5"
      >
        Send Message
      </button>
    </form>
  );
}
