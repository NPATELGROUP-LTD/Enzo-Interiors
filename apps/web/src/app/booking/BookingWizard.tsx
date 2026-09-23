"use client";

// Ported from Boilerplate:src/app/components/pages/BookingPage.tsx. That
// version put the whole 5-step wizard (step state, calendar math, contact
// form, confirmation) in one component — no server data is involved (this
// is a client-only mock booking flow, same as QuoteModal.tsx's "no real
// submission endpoint exists yet" pattern), so it stays that way here. The
// only structural change from the boilerplate is the App Router split: the
// route's page.tsx (Server Component) reads `?service=`/`?tier=` and passes
// them down as initial state, this file owns everything interactive.
//
// Deviations from the boilerplate:
// - No `useScrollToTop()` port: that hook called react-router's
//   `useLocation()`, which doesn't exist here. Next's App Router already
//   scrolls new pages to the top on navigation by default, so the hook has
//   no equivalent behavior left to port.
// - Raw hex literals (`#1C4A3A`, `#F2F0EB`, etc.) are replaced with the
//   matching tokens from src/styles/theme.css (bg-primary, text-secondary,
//   bg-sidebar-accent, ...) instead of arbitrary-value Tailwind classes.
// - `tier` (from the Service Detail quote-to-booking handoff) isn't a wizard
//   step on its own — the boilerplate never had one — so it's surfaced as
//   read-only context: a note under Step 1's heading, and folded into the
//   confirmation summary + toast, mirroring how QuoteModal.tsx appends tier
//   to its own toast message.
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  Bed,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  Clock,
  DoorOpen,
  Tv,
} from "lucide-react";
import { toast } from "sonner";
import { Honeypot } from "@/components/shared/Honeypot";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { sendEnquiry } from "@/lib/enquiry";
import {
  fill,
  type BookingPageContent,
  type MediaItem,
  type Testimonial,
} from "@/lib/content";

/**
 * Step 1's cards are the published services, so the wizard's list cannot
 * drift from the site's. The records carry a lucide icon *name*; this is the
 * one place that turns it back into a glyph, exactly as the navbar does.
 */
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ChefHat,
  Bed,
  Tv,
  DoorOpen,
};

/** One option per published service — id, label and icon, joined upstream. */
export interface BookingServiceOption {
  id: string;
  label: string;
  icon: string;
}

/** The four questions. The fifth screen is the confirmation, not a step. */
const TOTAL_STEPS = 4;

export function BookingWizard({
  initialService,
  initialTier,
  content,
  services,
  backgroundImage,
  quote,
}: {
  initialService?: string;
  initialTier?: string;
  content: BookingPageContent;
  services: BookingServiceOption[];
  backgroundImage: MediaItem;
  /** The panel's review, by id — the same record /portfolio quotes. */
  quote: Testimonial | null;
}) {
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string>(
    initialService ?? "",
  );
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState("");

  const today = new Date();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  const todayDate = today.getDate();

  const [currentMonth, setCurrentMonth] = useState(todayMonth);
  const [currentYear, setCurrentYear] = useState(todayYear);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [sending, setSending] = useState(false);
  const [trap, setTrap] = useState("");

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const unavailableDays = [3, 7, 14, 21, 28]; // Sundays and some dates — mock data

  const isPastMonth =
    currentYear < todayYear ||
    (currentYear === todayYear && currentMonth < todayMonth);

  const isPastDate = (day: number): boolean => {
    if (currentYear > todayYear) return false;
    if (currentYear < todayYear) return true;
    if (currentMonth > todayMonth) return false;
    if (currentMonth < todayMonth) return true;
    return day < todayDate;
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!selectedService;
      case 2:
        return selectedDate !== null;
      case 3:
        return !!selectedTime;
      case 4:
        return !!(contactForm.name && contactForm.email && contactForm.phone);
      default:
        return false;
    }
  };

  const handleConfirm = () => {
    if (sending || selectedDate === null) return;
    setSending(true);
    // The day as the visitor picked it, and as ISO so it sorts in the inbox.
    const day = new Date(currentYear, currentMonth, selectedDate);
    const iso = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(selectedDate).padStart(2, "0")}`;
    sendEnquiry(
      {
        kind: "booking",
        name: contactForm.name,
        email: contactForm.email,
        phone: contactForm.phone,
        message: contactForm.notes,
        details: {
          service: services.find((option) => option.id === selectedService)?.label ?? selectedService,
          tier: initialTier,
          date: `${content.calendar.months[day.getMonth()]} ${day.getDate()}, ${day.getFullYear()} (${iso})`,
          time: selectedTime,
        },
        website: trap,
      },
      content.toast.error,
    )
      .then(() => {
        const suffix = initialTier
          ? fill(content.toast.tierSuffix, { tier: initialTier })
          : "";
        toast.success(fill(content.toast.message, { suffix }));
        setStep(5);
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setSending(false));
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Back to Home link - mobile */}
      <Link
        href="/"
        className="fixed top-4 right-4 z-50 lg:hidden px-4 py-2 rounded-full bg-background/90 text-primary text-[12px] backdrop-blur-sm"
      >
        {content.backToHomeLabel}
      </Link>
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[40%] relative bg-primary flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-20">
          <ImageWithFallback
            src={backgroundImage.src}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative z-10">
          <span
            className="font-title text-primary-foreground"
            style={{ fontSize: "1.5rem", fontWeight: 600 }}
          >
            {content.wordmark.name}{" "}
            <span
              style={{
                fontWeight: 300,
                fontStyle: "normal",
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
              }}
            >
              {content.wordmark.suffix}
            </span>
          </span>
        </div>
        <div className="relative z-10">
          <h1
            className="text-primary-foreground"
            style={{ fontSize: "2.5rem", lineHeight: 1.15 }}
          >
            {content.panel.headingLines.map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </h1>
          <p className="text-secondary mt-4 text-[15px] leading-relaxed max-w-sm">
            {content.panel.lede}
          </p>
          <ul className="mt-8 space-y-3">
            {content.panel.benefits.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-primary-foreground/80 text-[14px]"
              >
                <Check size={14} className="text-secondary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        {quote && (
          <div className="relative z-10 bg-sidebar-accent rounded-xl p-6 mt-8">
            <p className="text-primary-foreground/80 text-[14px] italic leading-relaxed">
              &ldquo;{quote.pullQuote ?? quote.text}&rdquo;
            </p>
            <p className="text-secondary text-[13px] mt-3">
              {fill(content.panel.attribution, {
                name: quote.name,
                role: quote.role,
              })}
            </p>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-background min-h-screen pt-24 lg:pt-0 flex flex-col">
        {/* Progress */}
        <div className="p-6 md:p-12 pb-0">
          <div className="flex items-center justify-between mb-2">
            {/* forest-light, not `text-secondary`: the sage secondary is
                #8A9E8C, which on this cream ground measures 2.51:1 — the
                one piece of text telling you where you are in a four-step
                form was the least readable thing in it. */}
            <span className="text-enzo-forest-light text-[12px] uppercase tracking-[0.2em]">
              {step <= TOTAL_STEPS
                ? fill(content.progress.step, { step, total: TOTAL_STEPS })
                : content.progress.confirmed}
            </span>
          </div>
          <div className="h-1 bg-border/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{
                width: `${step > TOTAL_STEPS ? 100 : (step / TOTAL_STEPS) * 100}%`,
              }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        <div className="flex-1 p-6 md:p-12">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepWrapper key="step1">
                <h2 className="text-primary" style={{ fontSize: "1.8rem" }}>
                  {content.steps.service.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">
                  {content.steps.service.lede}
                </p>
                {initialTier && (
                  <p className="text-primary text-[13px] mt-2" style={{ fontWeight: 600 }}>
                    {fill(content.steps.service.tierNote, { tier: initialTier })}
                  </p>
                )}
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {services.map(({ id, label, icon }) => {
                    const Icon = ICONS[icon] ?? ChefHat;
                    return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedService(id)}
                      className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                        selectedService === id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-secondary"
                      }`}
                    >
                      <Icon
                        size={28}
                        className={
                          selectedService === id
                            ? "text-primary"
                            : "text-secondary"
                        }
                      />
                      <p
                        className={`mt-3 text-[15px] ${selectedService === id ? "text-primary" : "text-foreground"}`}
                        style={{ fontWeight: 500 }}
                      >
                        {label}
                      </p>
                    </button>
                    );
                  })}
                </div>
              </StepWrapper>
            )}

            {step === 2 && (
              <StepWrapper key="step2">
                <h2 className="text-primary" style={{ fontSize: "1.8rem" }}>
                  {content.steps.date.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">
                  {content.steps.date.lede}
                </p>
                <div className="mt-8 bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentMonth === 0) {
                          setCurrentMonth(11);
                          setCurrentYear(currentYear - 1);
                        } else {
                          setCurrentMonth(currentMonth - 1);
                        }
                      }}
                      disabled={isPastMonth}
                      className={`${isPastMonth ? "text-border/40 cursor-not-allowed" : "text-secondary hover:text-primary"}`}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span
                      className="text-primary text-[15px]"
                      style={{ fontWeight: 500 }}
                    >
                      {content.calendar.months[currentMonth]} {currentYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentMonth === 11) {
                          setCurrentMonth(0);
                          setCurrentYear(currentYear + 1);
                        } else {
                          setCurrentMonth(currentMonth + 1);
                        }
                      }}
                      className="text-secondary hover:text-primary"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {content.calendar.weekdays.map(
                      (d) => (
                        <div
                          key={d}
                          className="text-secondary text-[11px] uppercase tracking-wider py-2"
                        >
                          {d}
                        </div>
                      ),
                    )}
                    {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const isUnavailable =
                        unavailableDays.includes(day) || isPastDate(day);
                      const isSelected = selectedDate === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={isUnavailable}
                          onClick={() => setSelectedDate(day)}
                          className={`h-10 w-10 mx-auto rounded-full text-[13px] transition-all duration-200 ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : isUnavailable
                                ? "text-border cursor-not-allowed"
                                : "text-foreground hover:bg-primary/10"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </StepWrapper>
            )}

            {step === 3 && (
              <StepWrapper key="step3">
                <h2 className="text-primary" style={{ fontSize: "1.8rem" }}>
                  {content.steps.time.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">
                  {content.steps.time.lede}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {content.timeSlots.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={`px-6 py-3 rounded-full text-[14px] transition-all duration-300 ${
                        selectedTime === time
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-foreground hover:border-primary"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </StepWrapper>
            )}

            {step === 4 && (
              <StepWrapper key="step4">
                <h2 className="text-primary" style={{ fontSize: "1.8rem" }}>
                  {content.steps.details.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">
                  {content.steps.details.lede}
                </p>
                <div className="mt-8 space-y-4 max-w-md">
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, name: e.target.value })
                    }
                    placeholder={content.steps.details.placeholders.name}
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all"
                    required
                  />
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                    placeholder={content.steps.details.placeholders.email}
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all"
                    required
                  />
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone: e.target.value })
                    }
                    placeholder={content.steps.details.placeholders.phone}
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all"
                    required
                  />
                  <textarea
                    value={contactForm.notes}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, notes: e.target.value })
                    }
                    placeholder={content.steps.details.placeholders.notes}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all resize-none"
                  />
                  <Honeypot value={trap} onChange={setTrap} />
                </div>
              </StepWrapper>
            )}

            {step === 5 && (
              <StepWrapper key="step5">
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto">
                    <Check size={36} className="text-primary-foreground" />
                  </div>
                  <h2 className="text-primary mt-6" style={{ fontSize: "2rem" }}>
                    {content.steps.confirmation.heading}
                  </h2>
                  <p className="text-muted-foreground mt-3 text-[15px] max-w-md mx-auto">
                    {content.steps.confirmation.body}
                  </p>
                  <div className="mt-8 bg-white rounded-2xl p-6 max-w-sm mx-auto shadow-[0_2px_16px_rgba(0,0,0,0.04)] text-left">
                    <div className="space-y-3 text-[14px]">
                      <div className="flex items-center gap-3">
                        <span className="text-secondary">
                          {content.steps.confirmation.serviceLabel}
                        </span>
                        <span className="text-foreground">
                          {services.find((s) => s.id === selectedService)?.label}
                          {initialTier
                            ? fill(content.steps.confirmation.tierSuffix, {
                                tier: initialTier,
                              })
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-secondary" />
                        <span className="text-foreground">
                          {selectedDate} {content.calendar.months[currentMonth]}{" "}
                          {currentYear}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock size={14} className="text-secondary" />
                        <span className="text-foreground">{selectedTime}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </StepWrapper>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        {step <= TOTAL_STEPS && (
          <div className="p-6 md:p-12 pt-0 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className={`px-6 py-2.5 rounded-full border border-border text-foreground text-[14px] hover:border-primary transition-all ${step === 1 ? "opacity-0 pointer-events-none" : ""}`}
            >
              {content.nav.backLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                if (step === TOTAL_STEPS) handleConfirm();
                else setStep((s) => s + 1);
              }}
              disabled={!canProceed() || sending}
              aria-busy={sending}
              className="px-8 py-2.5 rounded-full bg-primary text-primary-foreground text-[14px] hover:bg-enzo-forest-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === TOTAL_STEPS ? content.nav.confirmLabel : content.nav.nextLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
