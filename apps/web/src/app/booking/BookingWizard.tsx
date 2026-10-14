"use client";

// The consultation booking wizard: service, day, time, details, confirmed.
// The route's page.tsx (a Server Component) validates `?service=`/`?tier=`
// and hands them down as initial state; everything interactive lives here.
//
// Days and times come from the API (`GET /booking/availability`), worked out
// from the schedule set in the admin's Settings minus what is already booked,
// so a taken time is never offered. Booking is `POST /booking`, which checks
// the time again and answers 409 if someone got there first. Which contact
// fields are asked for, and which services can be booked, are also Settings.
import { useEffect, useMemo, useState } from "react";
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
import { OpeningHoursList } from "@/components/shared/OpeningHoursList";
import {
  SlotTakenError,
  fetchAvailability,
  sendBooking,
  type Availability,
  type FieldRule,
} from "@/lib/booking";
import {
  fill,
  type BookingPageContent,
  type MediaItem,
  type StudioHours,
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

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/** "14:30" -> "2:30pm", the way the rest of the site writes times. */
function clock(time: string): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)}${h < 12 ? "am" : "pm"}`;
}

/** Today as a studio date. The studio is in Leicester, whatever the visitor's zone. */
function studioToday(): { year: number; month: number; day: number } {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" })
    .format(new Date())
    .split("-")
    .map(Number);
  return { year: year!, month: month! - 1, day: day! };
}

type ContactKey = "phone" | "address" | "postcode" | "notes";
const CONTACT_KEYS: ContactKey[] = ["phone", "address", "postcode", "notes"];
const INPUT =
  "w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary focus:bg-white transition-all";

export function BookingWizard({
  initialService,
  initialTier,
  content,
  services,
  backgroundImage,
  quote,
  logos,
  hours,
}: {
  initialService?: string;
  initialTier?: string;
  content: BookingPageContent;
  services: BookingServiceOption[];
  backgroundImage: MediaItem;
  /** The panel's review, by id — the same record /portfolio quotes. */
  quote: Testimonial | null;
  logos: { onLight: MediaItem; onDark: MediaItem };
  /** The studio's opening hours, printed under the calendar. */
  hours: StudioHours;
}) {
  const [today] = useState(studioToday);
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string>(initialService ?? "");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [view, setView] = useState({ year: today.year, month: today.month });
  /** The latest answer; kept while another month loads, for the form's rules. */
  const [free, setFree] = useState<Availability | null>(null);
  /** Which request `free` answers (month + attempt), or that it failed. */
  const [loaded, setLoaded] = useState<{ key: string; ok: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<Record<"name" | "email" | ContactKey, string>>({
    name: "",
    email: "",
    phone: "",
    address: "",
    postcode: "",
    notes: "",
  });
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [trap, setTrap] = useState("");

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const monthStart = isoDate(view.year, view.month, 1);
  const monthEnd = isoDate(view.year, view.month, daysInMonth);

  const requestKey = `${monthStart}|${attempt}`;
  const calendarState = loaded?.key !== requestKey ? "loading" : loaded.ok ? "ready" : "failed";
  const load = () => setAttempt((n) => n + 1);

  useEffect(() => {
    let live = true;
    fetchAvailability(monthStart, monthEnd)
      .then((result) => {
        if (!live) return;
        setFree(result);
        setLoaded({ key: requestKey, ok: true });
      })
      .catch(() => live && setLoaded({ key: requestKey, ok: false }));
    return () => {
      live = false;
    };
  }, [requestKey, monthStart, monthEnd]);

  // Services the studio takes bookings for; all of them unless Settings narrows it.
  const bookable = useMemo(
    () => (free?.services.length ? services.filter((s) => free.services.includes(s.id)) : services),
    [free, services],
  );

  const fields: Record<ContactKey, FieldRule> = free?.fields ?? {
    phone: "required",
    address: "off",
    postcode: "optional",
    notes: "optional",
  };

  const isFirstMonth = view.year === today.year && view.month === today.month;
  const lastBookable = free
    ? new Date(Date.UTC(today.year, today.month, today.day + free.horizonDays)).toISOString().slice(0, 10)
    : null;
  const isLastMonth = lastBookable !== null && monthEnd >= lastBookable;
  const times = selectedDate ? (free?.days[selectedDate] ?? []) : [];
  const serviceLabel = services.find((s) => s.id === selectedService)?.label;
  // The tier belongs to the service the quote request named: pick another and it no longer applies.
  const tier = selectedService === initialService ? initialTier : undefined;

  const canProceed = () => {
    switch (step) {
      case 1:
        return bookable.some((s) => s.id === selectedService);
      case 2:
        return selectedDate !== null && times.length > 0;
      case 3:
        return times.includes(selectedTime);
      case 4:
        return (
          !!form.name.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
          CONTACT_KEYS.every((key) => fields[key] !== "required" || !!form[key].trim())
        );
      default:
        return false;
    }
  };

  const moveMonth = (delta: number) => {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  const handleConfirm = () => {
    if (sending || !selectedDate) return;
    setSending(true);
    const contact = Object.fromEntries(
      CONTACT_KEYS.filter((key) => fields[key] !== "off").map((key) => [key, form[key]]),
    );
    sendBooking(
      {
        service: selectedService,
        date: selectedDate,
        time: selectedTime,
        name: form.name,
        email: form.email,
        ...contact,
        tier,
        website: trap,
      },
      content.toast.error,
    )
      .then((result) => {
        const suffix = tier ? fill(content.toast.tierSuffix, { tier }) : "";
        toast.success(fill(content.toast.message, { suffix }));
        setReference(result.reference ?? null);
        setStep(5);
      })
      .catch((error: Error) => {
        if (error instanceof SlotTakenError) {
          toast.error(content.toast.taken);
          setSelectedTime("");
          setStep(3);
          load();
        } else {
          toast.error(error.message);
        }
      })
      .finally(() => setSending(false));
  };

  const placeholder = (key: ContactKey) => {
    const text = content.steps.details.placeholders[key];
    const suffix = content.steps.details.optionalSuffix;
    return fields[key] === "optional" && !text.toLowerCase().includes(suffix.trim().toLowerCase())
      ? `${text}${suffix}`
      : text;
  };

  const prettyDate = selectedDate
    ? (() => {
        const [y, m, d] = selectedDate.split("-").map(Number);
        return `${d} ${content.calendar.months[m! - 1]} ${y}`;
      })()
    : "";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[40%] relative bg-primary flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-20">
          <ImageWithFallback src={backgroundImage.src} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10">
          <Link href="/" aria-label={content.logoLabel} className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small logo from the media bucket; next/image would need its host configured for no gain */}
            <img src={logos.onDark.src} alt={logos.onDark.alt} className="h-11 w-auto" />
          </Link>
        </div>
        <div className="relative z-10">
          <h1 className="text-primary-foreground" style={{ fontSize: "2.5rem", lineHeight: 1.15 }}>
            {content.panel.headingLines.map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </h1>
          <p className="text-secondary mt-4 text-[15px] leading-relaxed max-w-sm">{content.panel.lede}</p>
          <ul className="mt-8 space-y-3">
            {content.panel.benefits.map((item) => (
              <li key={item} className="flex items-center gap-3 text-primary-foreground/80 text-[14px]">
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
              {fill(content.panel.attribution, { name: quote.name, role: quote.role })}
            </p>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-background min-h-screen flex flex-col">
        {/* Phones and tablets have no side panel, so the logo and the way home sit here. */}
        <div className="flex items-center justify-between gap-4 px-6 pt-6 md:px-12 lg:hidden">
          <Link href="/" aria-label={content.logoLabel}>
            {/* eslint-disable-next-line @next/next/no-img-element -- see the panel logo above */}
            <img src={logos.onLight.src} alt={logos.onLight.alt} className="h-9 w-auto" />
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-full border border-border text-primary text-[12px] hover:border-primary transition-colors"
          >
            {content.backToHomeLabel}
          </Link>
        </div>

        {/* Progress */}
        <div className="p-6 md:p-12 pb-0">
          <div className="flex items-center justify-between mb-2">
            {/* forest-light, not `text-secondary`: the sage secondary measures
                2.51:1 on this cream ground, too faint for the one line saying
                where you are in the form. */}
            <span className="text-enzo-forest-light text-[12px] uppercase tracking-[0.2em]">
              {step <= TOTAL_STEPS
                ? fill(content.progress.step, { step, total: TOTAL_STEPS })
                : content.progress.confirmed}
            </span>
          </div>
          <div className="h-1 bg-border/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${step > TOTAL_STEPS ? 100 : (step / TOTAL_STEPS) * 100}%` }}
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
                <p className="text-muted-foreground text-[14px] mt-2">{content.steps.service.lede}</p>
                {tier && (
                  <p className="text-primary text-[13px] mt-2" style={{ fontWeight: 600 }}>
                    {fill(content.steps.service.tierNote, { tier })}
                  </p>
                )}
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {bookable.map(({ id, label, icon }) => {
                    const Icon = ICONS[icon] ?? ChefHat;
                    const selected = selectedService === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedService(id)}
                        className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                          selected ? "border-primary bg-primary/5" : "border-border hover:border-secondary"
                        }`}
                      >
                        <Icon size={28} className={selected ? "text-primary" : "text-secondary"} />
                        <p
                          className={`mt-3 text-[15px] ${selected ? "text-primary" : "text-foreground"}`}
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
                <p className="text-muted-foreground text-[14px] mt-2">{content.steps.date.lede}</p>
                <div className="mt-8 bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)] max-w-md">
                  <div className="flex items-center justify-between mb-6">
                    <button
                      type="button"
                      onClick={() => moveMonth(-1)}
                      disabled={isFirstMonth}
                      aria-label={content.calendar.previous}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:text-primary hover:bg-primary/5 disabled:text-border/40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-primary text-[15px]" style={{ fontWeight: 500 }} aria-live="polite">
                      {content.calendar.months[view.month]} {view.year}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveMonth(1)}
                      disabled={isLastMonth}
                      aria-label={content.calendar.next}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:text-primary hover:bg-primary/5 disabled:text-border/40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  {calendarState === "failed" ? (
                    <div className="py-10 text-center">
                      <p className="text-[14px] text-muted-foreground">{content.calendar.error}</p>
                      <button
                        type="button"
                        onClick={load}
                        className="mt-4 px-5 py-2 rounded-full border border-border text-[13px] text-primary hover:border-primary"
                      >
                        {content.calendar.retry}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 gap-1 text-center" aria-busy={calendarState === "loading"}>
                      {content.calendar.weekdays.map((d) => (
                        <div key={d} className="text-secondary text-[11px] uppercase tracking-wider py-2">
                          {d}
                        </div>
                      ))}
                      {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const date = isoDate(view.year, view.month, day);
                        const open = calendarState === "ready" && !!free?.days[date]?.length;
                        const isSelected = selectedDate === date;
                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={!open}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedDate(date);
                              setSelectedTime("");
                            }}
                            className={`relative h-10 w-10 mx-auto rounded-full text-[13px] transition-all duration-200 ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : open
                                  ? "text-foreground font-medium hover:bg-primary/10"
                                  : "text-border cursor-not-allowed"
                            } ${calendarState === "loading" ? "animate-pulse" : ""}`}
                          >
                            {day}
                            {open && !isSelected ? (
                              <span aria-hidden className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-secondary" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-4 min-h-5 text-center text-[13px] text-muted-foreground" role="status">
                    {calendarState === "loading"
                      ? content.calendar.loading
                      : calendarState === "ready" && free && Object.keys(free.days).length === 0
                        ? content.calendar.empty
                        : ""}
                  </p>
                </div>
                <OpeningHoursList
                  label={content.calendar.hoursLabel ?? "Studio hours"}
                  rows={hours.rows}
                  note={hours.note}
                  className="mt-8 max-w-md"
                />
              </StepWrapper>
            )}

            {step === 3 && (
              <StepWrapper key="step3">
                <h2 className="text-primary" style={{ fontSize: "1.8rem" }}>
                  {content.steps.time.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">
                  {content.steps.time.lede} <span className="text-primary">{prettyDate}</span>
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {times.map((time) => (
                    <button
                      key={time}
                      type="button"
                      aria-pressed={selectedTime === time}
                      onClick={() => setSelectedTime(time)}
                      className={`px-6 py-3 rounded-full text-[14px] transition-all duration-300 ${
                        selectedTime === time
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-foreground hover:border-primary"
                      }`}
                    >
                      {clock(time)}
                    </button>
                  ))}
                </div>
                {times.length === 0 && calendarState !== "loading" ? (
                  <p className="mt-6 text-[14px] text-muted-foreground">{content.calendar.empty}</p>
                ) : null}
              </StepWrapper>
            )}

            {step === 4 && (
              <StepWrapper key="step4">
                <h2 className="text-primary" style={{ fontSize: "1.8rem" }}>
                  {content.steps.details.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">{content.steps.details.lede}</p>
                <div className="mt-8 space-y-4 max-w-md">
                  <input
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={content.steps.details.placeholders.name}
                    aria-label={content.steps.details.placeholders.name}
                    className={INPUT}
                    required
                  />
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={content.steps.details.placeholders.email}
                    aria-label={content.steps.details.placeholders.email}
                    className={INPUT}
                    required
                  />
                  {fields.phone !== "off" && (
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder={placeholder("phone")}
                      aria-label={placeholder("phone")}
                      className={INPUT}
                      required={fields.phone === "required"}
                    />
                  )}
                  {fields.address !== "off" && (
                    <input
                      type="text"
                      autoComplete="address-line1"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder={placeholder("address")}
                      aria-label={placeholder("address")}
                      className={INPUT}
                      required={fields.address === "required"}
                    />
                  )}
                  {fields.postcode !== "off" && (
                    <input
                      type="text"
                      autoComplete="postal-code"
                      value={form.postcode}
                      onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                      placeholder={placeholder("postcode")}
                      aria-label={placeholder("postcode")}
                      className={`${INPUT} max-w-[12rem] uppercase placeholder:normal-case`}
                      maxLength={10}
                      required={fields.postcode === "required"}
                    />
                  )}
                  {fields.notes !== "off" && (
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder={placeholder("notes")}
                      aria-label={placeholder("notes")}
                      rows={3}
                      className={`${INPUT} resize-none`}
                      required={fields.notes === "required"}
                    />
                  )}
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
                        <span className="text-secondary">{content.steps.confirmation.serviceLabel}</span>
                        <span className="text-foreground">
                          {serviceLabel}
                          {tier ? fill(content.steps.confirmation.tierSuffix, { tier }) : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-secondary" />
                        <span className="text-foreground">{prettyDate}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock size={14} className="text-secondary" />
                        <span className="text-foreground">{clock(selectedTime)}</span>
                      </div>
                      {reference ? (
                        <div className="flex items-center gap-3 border-t border-border/40 pt-3">
                          <span className="text-secondary">{content.steps.confirmation.referenceLabel}</span>
                          <span className="font-medium tracking-wide text-foreground">{reference}</span>
                        </div>
                      ) : null}
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
