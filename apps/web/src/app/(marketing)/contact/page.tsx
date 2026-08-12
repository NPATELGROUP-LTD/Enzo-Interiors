// Ported from Boilerplate:src/app/components/pages/ContactPage.tsx.
// Server Component — the map embed, contact details, and WhatsApp strip
// are static and render on the server. The form (local useState + mock
// submit/toast) is split into ./ContactForm.tsx as a Client Component,
// per the SSR-by-default / animation-and-state-is-client-only rule.
import Link from "next/link";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { ContactForm } from "./ContactForm";

export default function ContactPage() {
  return (
    <div>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-background">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <p className="text-secondary text-[12px] uppercase tracking-[0.2em] mb-4">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>{" "}
            / Contact
          </p>
          <h1
            className="text-primary"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
          >
            Get In Touch
          </h1>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 pb-24 bg-background">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row gap-12">
            {/* Map */}
            <ScrollReveal className="md:w-[55%]">
              <div className="rounded-2xl overflow-hidden h-[400px] md:h-[600px] bg-muted">
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
              <ContactForm />

              {/* Contact Details */}
              <div className="mt-10 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone size={16} className="text-primary" />
                  </div>
                  <span className="text-foreground text-[14px]">
                    0116 XXX XXXX
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail size={16} className="text-primary" />
                  </div>
                  <span className="text-foreground text-[14px]">
                    hello@enzointeriors.co.uk
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin size={16} className="text-primary" />
                  </div>
                  <span className="text-foreground text-[14px]">
                    Leicester &amp; Leicestershire
                  </span>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* WhatsApp Strip */}
          <ScrollReveal className="mt-16">
            <div className="bg-primary rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <MessageCircle size={28} className="text-white" />
                <div>
                  <p
                    className="text-white text-[16px]"
                    style={{ fontWeight: 500 }}
                  >
                    Prefer to chat?
                  </p>
                  <p className="text-enzo-sage text-[14px]">
                    Message us directly on WhatsApp
                  </p>
                </div>
              </div>
              <a
                href="#"
                className="px-8 py-3 rounded-full bg-white text-primary text-[14px] tracking-wide hover:bg-background transition-all duration-300"
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
