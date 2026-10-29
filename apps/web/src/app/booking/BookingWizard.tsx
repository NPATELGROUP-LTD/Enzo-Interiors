"use client";

// The consultation booking wizard: service, date & time, details, review, confirmed.
// The route's page.tsx (a Server Component) validates `?service=`/`?tier=`
// and hands them down as initial state; everything interactive lives here.
//
// Days and times come from the API (`GET /booking/availability`), worked out
// from the schedule set in the admin's Settings minus what is already booked,
// so a taken time is never offered. Booking is `POST /booking`, which checks
// the time again and answers 409 if someone got there first. Which contact
// fields are asked for, and which services can be booked, are also Settings.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import Link from "next/link";
import { Bed, Calendar, Check, ChevronLeft, ChevronRight, ChefHat, Clock, DoorOpen, Tv } from "lucide-react";
import { toast } from "sonner";
import { Honeypot } from "@/components/shared/Honeypot";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { OpeningHoursList } from "@/components/shared/OpeningHoursList";
import { SPAM_HINT } from "@/lib/utils";
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

/** Service, date & time, details, review. The fifth screen is the confirmation, not a step. */
const TOTAL_STEPS = 4;
const SERVICE = 1;
const WHEN = 2;
const DETAILS = 3;
const REVIEW = 4;
const DONE = 5;

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
type FormKey = "name" | "email" | ContactKey;
const CONTACT_KEYS: ContactKey[] = ["phone", "address", "postcode", "notes"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT =
  "w-full min-h-12 px-4 py-3 rounded-xl bg-white border border-border text-[16px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 aria-[invalid=true]:border-destructive";
const HEADING = "text-primary focus:outline-none";

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
  const [step, setStep] = useState(SERVICE);
  const [selectedService, setSelectedService] = useState<string>(initialService ?? "");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [view, setView] = useState({ year: today.year, month: today.month });
  /** The latest answer; kept while another month loads, for the form's rules. */
  const [free, setFree] = useState<Availability | null>(null);
  /** Which request `free` answers (month + attempt), or that it failed. */
  const [loaded, setLoaded] = useState<{ key: string; ok: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<Record<FormKey, string>>({
    name: "",
    email: "",
    phone: "",
    address: "",
    postcode: "",
    notes: "",
  });
  /** Fields the visitor has left, plus all of them once Next was tried: errors show only for these. */
  const [touched, setTouched] = useState<Partial<Record<FormKey, true>>>({});
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [trap, setTrap] = useState("");
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timesRef = useRef<HTMLDivElement>(null);

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

  // Each new screen starts at its heading, so a keyboard or screen-reader user lands on it.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  // Services the studio takes bookings for; all of them unless Settings narrows it.
  const bookable = useMemo(
    () => (free?.services.length ? services.filter((s) => free.services.includes(s.id)) : services),
    [free, services],
  );

  const fields: Record<ContactKey, FieldRule> = free?.fields ?? {
    phone: "required",
    address: "optional",
    postcode: "required",
    notes: "optional",
  };

  const isFirstMonth = view.year === today.year && view.month === today.month;
  const lastBookable = free
    ? new Date(Date.UTC(today.year, today.month, today.day + free.horizonDays)).toISOString().slice(0, 10)
    : null;
  const isLastMonth = lastBookable !== null && monthEnd >= lastBookable;
  const times = selectedDate ? (free?.days[selectedDate] ?? []) : [];
  const morning = times.filter((t) => Number(t.split(":")[0]) < 12);
  const afternoon = times.filter((t) => Number(t.split(":")[0]) >= 12);
  const serviceLabel = services.find((s) => s.id === selectedService)?.label;
  // The tier belongs to the service the quote request named: pick another and it no longer applies.
  const tier = selectedService === initialService ? initialTier : undefined;
  const copy = content.steps.details;

  /** The message for a field that is not ready, or "" when it is. */
  const problem = (key: FormKey): string => {
    if (key === "name") return form.name.trim() ? "" : copy.errors.name;
    if (key === "email") return EMAIL.test(form.email.trim()) ? "" : copy.errors.email;
    return fields[key as ContactKey] === "required" && !form[key].trim() ? copy.errors.required : "";
  };
  const shown: FormKey[] = ["name", "email", ...CONTACT_KEYS.filter((key) => fields[key] !== "off")];
  const detailsValid = shown.every((key) => !problem(key));
  const error = (key: FormKey) => (touched[key] ? problem(key) : "");

  const canProceed = () => {
    if (step === SERVICE) return bookable.some((s) => s.id === selectedService);
    if (step === WHEN) return selectedDate !== null && times.includes(selectedTime);
    return step === DETAILS || step === REVIEW;
  };

  const next = () => {
    if (step === DETAILS && !detailsValid) {
      setTouched(Object.fromEntries(shown.map((key) => [key, true])));
      document.getElementById(`field-${shown.find((key) => problem(key))}`)?.focus();
      return;
    }
    if (step === REVIEW) handleConfirm();
    else setStep((s) => s + 1);
  };

  const moveMonth = (delta: number) => {
    const month = new Date(view.year, view.month + delta, 1);
    setView({ year: month.getFullYear(), month: month.getMonth() });
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
        toast.success(`${fill(content.toast.message, { suffix })} ${SPAM_HINT}`);
        setReference(result.reference ?? null);
        setStep(DONE);
      })
      .catch((failure: Error) => {
        if (failure instanceof SlotTakenError) {
          toast.error(content.toast.taken);
          setSelectedTime("");
          setStep(WHEN);
          load();
        } else {
          toast.error(failure.message);
        }
      })
      .finally(() => setSending(false));
  };

  // The badge says Required/Optional, so copy edited in the CMS that still says "(optional)" is trimmed.
  const labelOf = (key: FormKey) => copy.placeholders[key].replace(/\s*\(optional\)\s*$/i, "");

  const prettyDate = selectedDate
    ? (() => {
        const [y, m, d] = selectedDate.split("-").map(Number);
        return `${d} ${content.calendar.months[m! - 1]} ${y}`;
      })()
    : "";

  /** One labelled input. The label is always visible; the badge and error say what is wanted. */
  const field = (key: FormKey, props: { type?: string; autoComplete?: string; className?: string; maxLength?: number }) => {
    const rule: FieldRule = key === "name" || key === "email" ? "required" : fields[key as ContactKey];
    if (rule === "off") return null;
    const message = error(key);
    const common = {
      id: `field-${key}`,
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
      onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
      "aria-invalid": !!message,
      "aria-describedby": message ? `error-${key}` : undefined,
      "aria-required": rule === "required",
    };
    return (
      <div key={key}>
        <label htmlFor={`field-${key}`} className="flex items-baseline justify-between gap-3 text-[14px] text-foreground">
          <span style={{ fontWeight: 500 }}>{labelOf(key)}</span>
          <span className="text-[12px] text-muted-foreground">
            {rule === "required" ? copy.requiredLabel : copy.optionalLabel}
          </span>
        </label>
        {key === "notes" ? (
          <textarea {...common} rows={3} className={`${INPUT} mt-1.5 resize-none`} />
        ) : (
          <input {...common} type={props.type ?? "text"} autoComplete={props.autoComplete} maxLength={props.maxLength} className={`${INPUT} mt-1.5 ${props.className ?? ""}`} />
        )}
        {message ? (
          <p id={`error-${key}`} role="alert" className="mt-1.5 text-[13px] text-destructive">
            {message}
          </p>
        ) : null}
      </div>
    );
  };

  const summaryRows = [
    {
      label: content.steps.confirmation.serviceLabel.replace(/:$/, ""),
      value: `${serviceLabel ?? ""}${tier ? fill(content.steps.confirmation.tierSuffix, { tier }) : ""}`,
      icon: null,
      to: SERVICE,
    },
    {
      label: content.steps.review.whenLabel,
      value: `${prettyDate}, ${selectedTime ? clock(selectedTime) : ""}`,
      icon: Calendar,
      to: WHEN,
    },
  ];

  return (
    <div className="h-dvh overflow-hidden flex flex-col xl:flex-row">
      {/* Left Panel */}
      <div className="hidden xl:flex xl:w-[40%] xl:h-full relative bg-primary flex-col justify-between p-12 overflow-hidden">
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
      <div className="flex-1 min-h-0 bg-background flex flex-col">
        {/* Phones and tablets have no side panel, so the logo and the way home sit here. */}
        <div className="flex items-center justify-between gap-4 px-6 pt-6 md:px-12 xl:hidden">
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

        {/* Progress: every step named on wider screens, "Step n of 4" on phones. */}
        <nav aria-label={content.progress.confirmed} className="shrink-0 px-6 pt-5 md:px-12 xl:pt-8">
          <ol className="hidden sm:flex items-center gap-2">
            {content.progress.labels.map((label, index) => {
              const n = index + 1;
              const state = n < step ? "done" : n === step ? "current" : "todo";
              return (
                <li key={label} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={state === "current" ? "step" : undefined}>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] ${
                      state === "todo" ? "border border-border text-muted-foreground" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {state === "done" ? <Check size={14} /> : n}
                  </span>
                  <span className={`whitespace-nowrap text-[13px] ${state === "todo" ? "text-muted-foreground" : "text-primary"}`}>{label}</span>
                  {n < content.progress.labels.length ? <span className={`h-px flex-1 ${n < step ? "bg-primary" : "bg-border"}`} /> : null}
                </li>
              );
            })}
          </ol>
          <div className="sm:hidden">
            {/* forest-light, not `text-secondary`: the sage secondary measures 2.51:1 on this cream ground. */}
            <span className="text-enzo-forest-light text-[12px] uppercase tracking-[0.2em]">
              {step <= TOTAL_STEPS ? fill(content.progress.step, { step, total: TOTAL_STEPS }) : content.progress.confirmed}
            </span>
            <div className="mt-2 h-1 bg-border/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${step > TOTAL_STEPS ? 100 : (step / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 md:px-12 md:py-6">
          <AnimatePresence mode="wait">
            {step === SERVICE && (
              <StepWrapper key="service" still={!!reduceMotion}>
                <h2 ref={headingRef} tabIndex={-1} className={HEADING} style={{ fontSize: "1.8rem" }}>
                  {content.steps.service.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">{content.steps.service.lede}</p>
                {tier && (
                  <p className="text-primary text-[13px] mt-2" style={{ fontWeight: 600 }}>
                    {fill(content.steps.service.tierNote, { tier })}
                  </p>
                )}
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 max-w-2xl">
                  {bookable.map(({ id, label, icon }) => {
                    const Icon = ICONS[icon] ?? ChefHat;
                    const selected = selectedService === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedService(id)}
                        className={`relative flex min-h-24 items-center gap-4 rounded-2xl border-2 p-5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-col sm:items-start sm:gap-3 ${
                          selected ? "border-primary bg-primary/5" : "border-border bg-white hover:border-secondary"
                        }`}
                      >
                        <Icon size={28} className={selected ? "text-primary" : "text-secondary"} />
                        <span className={`text-[15px] ${selected ? "text-primary" : "text-foreground"}`} style={{ fontWeight: 500 }}>
                          {label}
                        </span>
                        {selected ? (
                          <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check size={12} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </StepWrapper>
            )}

            {step === WHEN && (
              <StepWrapper key="when" still={!!reduceMotion}>
                <h2 ref={headingRef} tabIndex={-1} className={HEADING} style={{ fontSize: "1.8rem" }}>
                  {content.steps.datetime.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">{content.steps.datetime.lede}</p>
                <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-8 max-w-4xl">
                  <div className="md:col-start-1">
                    <div className="bg-white rounded-2xl p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => moveMonth(-1)}
                          disabled={isFirstMonth}
                          aria-label={content.calendar.previous}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-secondary hover:text-primary hover:bg-primary/5 disabled:text-border/40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
                          className="flex h-11 w-11 items-center justify-center rounded-full text-secondary hover:text-primary hover:bg-primary/5 disabled:text-border/40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
                            className="mt-4 px-5 py-2.5 rounded-full border border-border text-[13px] text-primary hover:border-primary"
                          >
                            {content.calendar.retry}
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-7 gap-1 text-center" aria-busy={calendarState === "loading"}>
                          {content.calendar.weekdays.map((d) => (
                            <div key={d} className="text-secondary text-[11px] uppercase tracking-wider py-1">
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
                                  // Below md the times sit under the calendar, off screen on a phone.
                                  requestAnimationFrame(() =>
                                    !window.matchMedia("(min-width: 768px)").matches && timesRef.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }),
                                  );
                                }}
                                className={`relative mx-auto h-10 w-10 rounded-full text-[14px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : open
                                      ? "text-foreground font-medium hover:bg-primary/10"
                                      : "text-border cursor-not-allowed"
                                } ${calendarState === "loading" ? "animate-pulse motion-reduce:animate-none" : ""}`}
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
                      <p className="mt-2 min-h-5 text-center text-[13px] text-muted-foreground" role="status">
                        {calendarState === "loading"
                          ? content.calendar.loading
                          : calendarState === "ready" && free && Object.keys(free.days).length === 0
                            ? content.calendar.empty
                            : ""}
                      </p>
                    </div>
                  </div>

                  <div ref={timesRef} className="scroll-mt-6 md:col-start-2 md:row-span-2 md:row-start-1">
                    {selectedDate ? (
                      <>
                        <p className="flex items-center gap-2 text-[15px] text-primary" style={{ fontWeight: 500 }}>
                          <Calendar size={16} className="text-secondary" />
                          {prettyDate}
                        </p>
                        {[
                          [content.steps.datetime.morning, morning],
                          [content.steps.datetime.afternoon, afternoon],
                        ].map(([label, group]) =>
                          (group as string[]).length ? (
                            <div key={label as string} className="mt-3 first:mt-4">
                              <p className="text-[12px] uppercase tracking-[0.15em] text-muted-foreground">{label as string}</p>
                              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3">
                                {(group as string[]).map((time) => (
                                  <button
                                    key={time}
                                    type="button"
                                    aria-pressed={selectedTime === time}
                                    onClick={() => setSelectedTime(time)}
                                    className={`min-h-11 rounded-full px-3 text-[14px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                                      selectedTime === time
                                        ? "bg-primary text-primary-foreground"
                                        : "border border-border bg-white text-foreground hover:border-primary"
                                    }`}
                                  >
                                    {clock(time)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null,
                        )}
                      </>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-border p-6 text-[14px] text-muted-foreground">
                        {content.steps.datetime.pickDay}
                      </p>
                    )}
                  </div>

                  <details className="group md:col-start-1">
                    <summary className="cursor-pointer list-none font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                      {content.calendar.hoursLabel ?? "Studio hours"} <span aria-hidden className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
                    </summary>
                    <OpeningHoursList label="" rows={hours.rows} note={hours.note} className="mt-1" />
                  </details>
                </div>
              </StepWrapper>
            )}

            {step === DETAILS && (
              <StepWrapper key="details" still={!!reduceMotion}>
                <h2 ref={headingRef} tabIndex={-1} className={HEADING} style={{ fontSize: "1.8rem" }}>
                  {copy.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">{copy.lede}</p>
                <form
                  className="mt-8 space-y-5 max-w-md"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    next();
                  }}
                >
                  {field("name", { autoComplete: "name" })}
                  {field("email", { type: "email", autoComplete: "email" })}
                  {field("phone", { type: "tel", autoComplete: "tel" })}
                  {field("address", { autoComplete: "address-line1" })}
                  {field("postcode", { autoComplete: "postal-code", maxLength: 10, className: "max-w-[12rem] uppercase" })}
                  {field("notes", {})}
                  <Honeypot value={trap} onChange={setTrap} />
                </form>
              </StepWrapper>
            )}

            {step === REVIEW && (
              <StepWrapper key="review" still={!!reduceMotion}>
                <h2 ref={headingRef} tabIndex={-1} className={HEADING} style={{ fontSize: "1.8rem" }}>
                  {content.steps.review.heading}
                </h2>
                <p className="text-muted-foreground text-[14px] mt-2">{content.steps.review.lede}</p>
                <div className="mt-8 max-w-lg divide-y divide-border/60 rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
                  {summaryRows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-4 p-5">
                      <div>
                        <p className="text-[12px] uppercase tracking-[0.15em] text-muted-foreground">{row.label}</p>
                        <p className="mt-1 text-[15px] text-foreground">{row.value}</p>
                      </div>
                      <EditLink label={content.steps.review.edit} onClick={() => setStep(row.to)} />
                    </div>
                  ))}
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <p className="text-[12px] uppercase tracking-[0.15em] text-muted-foreground">{content.steps.review.detailsLabel}</p>
                      <dl className="mt-1 space-y-0.5 text-[15px] text-foreground">
                        {shown
                          .filter((key) => form[key].trim())
                          .map((key) => (
                            <div key={key} className="break-words">
                              <dt className="sr-only">{labelOf(key)}</dt>
                              <dd className={key === "postcode" ? "uppercase" : undefined}>{form[key].trim()}</dd>
                            </div>
                          ))}
                      </dl>
                    </div>
                    <EditLink label={content.steps.review.edit} onClick={() => setStep(DETAILS)} />
                  </div>
                </div>
                <p className="mt-4 max-w-lg text-[13px] text-muted-foreground">{content.steps.review.note}</p>
              </StepWrapper>
            )}

            {step === DONE && (
              <StepWrapper key="done" still={!!reduceMotion}>
                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto">
                    <Check size={36} className="text-primary-foreground" />
                  </div>
                  <h2 ref={headingRef} tabIndex={-1} className={`${HEADING} mt-6`} style={{ fontSize: "2rem" }}>
                    {content.steps.confirmation.heading}
                  </h2>
                  <p className="text-muted-foreground mt-3 text-[15px] max-w-md mx-auto">
                    {content.steps.confirmation.body} {SPAM_HINT}
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
                  <Link
                    href="/"
                    className="mt-8 inline-block rounded-full border border-border px-6 py-2.5 text-[14px] text-primary hover:border-primary transition-colors"
                  >
                    {content.steps.confirmation.homeLabel}
                  </Link>
                </div>
              </StepWrapper>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation: sits under the step area, so Next is always in view and the page itself never scrolls. */}
        {step < DONE && (
          <div className="shrink-0 border-t border-border/60 bg-background px-6 py-3 md:px-12">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(SERVICE, s - 1))}
                className={`min-h-11 rounded-full border border-border px-6 text-[14px] text-foreground transition-colors hover:border-primary ${step === SERVICE ? "invisible" : ""}`}
              >
                {content.nav.backLabel}
              </button>
              <button
                type="button"
                onClick={next}
                disabled={!canProceed() || sending}
                aria-busy={sending}
                className="min-h-11 rounded-full bg-primary px-8 text-[14px] text-primary-foreground transition-colors hover:bg-enzo-forest-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step === REVIEW ? content.nav.confirmLabel : step === DETAILS ? content.nav.reviewLabel : content.nav.nextLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 min-h-11 px-2 text-[13px] text-primary underline underline-offset-4 hover:text-enzo-forest-light">
      {label}
    </button>
  );
}

function StepWrapper({ children, still }: { children: React.ReactNode; still: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: still ? 0 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: still ? 0 : -20 }}
      transition={{ duration: still ? 0 : 0.3 }}
    >
      {children}
    </motion.div>
  );
}
