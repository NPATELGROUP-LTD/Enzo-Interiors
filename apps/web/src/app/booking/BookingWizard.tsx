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
import { Check, ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { BOOKING_SERVICES, type BookingServiceId } from "./services";

const BG_IMG =
  "https://images.unsplash.com/photo-1765766601532-90e9b96320c8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBpbnRlcmlvciUyMGRlc2lnbiUyMGRhcmslMjBtb29keSUyMGtpdGNoZW58ZW58MXx8fHwxNzcyMzk4MjMzfDA&ixlib=rb-4.1.0&q=80&w=1080";

const timeSlots = [
  "9:00am",
  "10:30am",
  "12:00pm",
  "1:30pm",
  "3:00pm",
  "4:30pm",
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function BookingWizard({
  initialService,
  initialTier,
}: {
  initialService?: BookingServiceId;
  initialTier?: string;
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
    const tierSuffix = initialTier ? ` (${initialTier} tier)` : "";
    toast.success(
      `Booking confirmed${tierSuffix}! We'll send you a confirmation email shortly.`,
    );
    setStep(5);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Back to Home link - mobile */}
      <Link
        href="/"
        className="fixed top-4 right-4 z-50 lg:hidden px-4 py-2 rounded-full bg-background/90 text-primary text-[12px] backdrop-blur-sm"
      >
        &larr; Back
      </Link>
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[40%] relative bg-primary flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-20">
          <ImageWithFallback
            src={BG_IMG}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative z-10">
          <span
            className="font-[Cormorant_Garamond] italic text-primary-foreground"
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
        </div>
        <div className="relative z-10">
          <h1
            className="text-primary-foreground"
            style={{ fontSize: "2.5rem", lineHeight: 1.15 }}
          >
            Book Your Free
            <br />
            Consultation
          </h1>
          <p className="text-secondary mt-4 text-[15px] leading-relaxed max-w-sm">
            Choose a date and time that suits you. We&apos;ll come to your
            home, discuss your ideas, and provide expert advice —
            completely free.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Free home visit",
              "No obligation",
              "Expert design advice",
              "Bring samples to your space",
            ].map((item) => (
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
        <div className="relative z-10 bg-sidebar-accent rounded-xl p-6 mt-8">
          <p className="text-primary-foreground/80 text-[14px] italic leading-relaxed">
            &ldquo;Enzo transformed our kitchen beyond our wildest dreams. The
            attention to detail is absolutely impeccable.&rdquo;
          </p>
          <p className="text-secondary text-[13px] mt-3">— Sarah T., Oadby</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-background min-h-screen pt-24 lg:pt-0 flex flex-col">
        {/* Progress */}
        <div className="p-6 md:p-12 pb-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-secondary text-[12px] uppercase tracking-[0.2em]">
              {step <= 4 ? `Step ${step} of 4` : "Confirmed"}
            </span>
          </div>
          <div className="h-1 bg-border/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${step >= 5 ? 100 : (step / 4) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        <div className="flex-1 p-6 md:p-12">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepWrapper key="step1">
                <h2 className="text-primary" style={{ fontSize: "1.8rem" }}>
                  What are you interested in?
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">
                  Select the service you&apos;d like to discuss.
                </p>
                {initialTier && (
                  <p className="text-primary text-[13px] mt-2" style={{ fontWeight: 600 }}>
                    Pre-filled from your {initialTier} tier quote request.
                  </p>
                )}
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {BOOKING_SERVICES.map(({ id, label, Icon }) => (
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
                  ))}
                </div>
              </StepWrapper>
            )}

            {step === 2 && (
              <StepWrapper key="step2">
                <h2 className="text-primary" style={{ fontSize: "1.8rem" }}>
                  Pick a date
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">
                  Choose a day that works for you.
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
                      {months[currentMonth]} {currentYear}
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
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
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
                  Choose a time
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">
                  Select a time slot that suits you.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {timeSlots.map((time) => (
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
                  Your details
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">
                  So we can get in touch to confirm.
                </p>
                <div className="mt-8 space-y-4 max-w-md">
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, name: e.target.value })
                    }
                    placeholder="Full name"
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all"
                    required
                  />
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                    placeholder="Email address"
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all"
                    required
                  />
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone: e.target.value })
                    }
                    placeholder="Phone number"
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all"
                    required
                  />
                  <textarea
                    value={contactForm.notes}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, notes: e.target.value })
                    }
                    placeholder="Any additional notes (optional)"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all resize-none"
                  />
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
                    Booking Confirmed!
                  </h2>
                  <p className="text-muted-foreground mt-3 text-[15px] max-w-md mx-auto">
                    We&apos;ve sent a confirmation to your email. We look
                    forward to meeting you!
                  </p>
                  <div className="mt-8 bg-white rounded-2xl p-6 max-w-sm mx-auto shadow-[0_2px_16px_rgba(0,0,0,0.04)] text-left">
                    <div className="space-y-3 text-[14px]">
                      <div className="flex items-center gap-3">
                        <span className="text-secondary">Service:</span>
                        <span className="text-foreground">
                          {
                            BOOKING_SERVICES.find(
                              (s) => s.id === selectedService,
                            )?.label
                          }
                          {initialTier ? ` (${initialTier})` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-secondary" />
                        <span className="text-foreground">
                          {selectedDate} {months[currentMonth]} {currentYear}
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
        {step <= 4 && (
          <div className="p-6 md:p-12 pt-0 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className={`px-6 py-2.5 rounded-full border border-border text-foreground text-[14px] hover:border-primary transition-all ${step === 1 ? "opacity-0 pointer-events-none" : ""}`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (step === 4) handleConfirm();
                else setStep((s) => s + 1);
              }}
              disabled={!canProceed()}
              className="px-8 py-2.5 rounded-full bg-primary text-primary-foreground text-[14px] hover:bg-enzo-forest-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === 4 ? "Confirm Booking" : "Next"}
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
