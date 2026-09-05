"use client";

// §C2 — the enquiry sheet.
//
// ── Fourth design ──
// The first was the boilerplate's five stacked inputs. The second was a
// near-black ladder: numbered rows in a narrow label column, translucent
// cream fields on a dark ground, and a sticky panel beside it narrating the
// enquiry back at you. Two things were wrong with it beyond taste.
//
//   · A dark form is a worse form. Fields at 4% cream on near-black have
//     barely any edge to them, the caret is hard to find, and the one part
//     of this site somebody has to *work* in was the hardest part to read.
//     Forms want the most contrast on the page, not the least.
//   · The narration panel took a third of the width to tell you what you
//     had just typed, which pushed the fields into a column too narrow for
//     two of them to sit side by side.
//
// The third answered both: a light sheet with real bordered fields, short
// answers paired two-to-a-row, and the room as chips rather than a native
// select. That much survives here. What did not was the *sheet* — one
// centred 54rem card with a forest header strip, which on a wide page is a
// business card adrift in the middle of the section and on a phone is a
// bordered card inside a bordered section.
//
// So the fourth uses the page: a sticky rail on the left with the mark, the
// statement and a checklist that ticks off the three required answers, and
// the fields in a column beside it. On a phone the card chrome comes off
// entirely and the fields become ruled lines — the form of a printed
// docket, and a fraction of the visual weight of six stacked boxes. See the
// layout comment on the grid below.
//
// Ground: near-white, between the cream masthead and the forest coverage
// band, so the sheet reads as a sheet laid on a table rather than another
// full-width slab of colour.
//
// Validation is unchanged from the second design because that part was
// right: visible labels, blur *and* submit checks, per-field errors tied
// with aria-describedby, and a failed submit that builds a summary, moves
// focus to it and links each item to its field.
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { toast } from "sonner";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface RoomOption {
  value: string;
  label: string;
}

interface FieldState {
  name: string;
  email: string;
  phone: string;
  room: string;
  place: string;
  message: string;
}

type FieldName = keyof FieldState;

const EMPTY: FieldState = {
  name: "",
  email: "",
  phone: "",
  room: "",
  place: "",
  message: "",
};

/** Required fields, in the order the sheet asks for them. */
const REQUIRED: FieldName[] = ["name", "email", "room"];

/**
 * Deliberately permissive. A contact form's job is to catch the typo that
 * makes a reply impossible ("priya@gmail" with no dot), not to adjudicate
 * RFC 5322 — every stricter pattern on the internet rejects somebody's
 * genuine address.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(field: FieldName, value: string): string | null {
  const trimmed = value.trim();
  switch (field) {
    case "name":
      return trimmed ? null : "Tell us what to call you.";
    case "email":
      if (!trimmed) return "We need an email address to reply to.";
      return EMAIL.test(trimmed) ? null : "That address is missing something — check it over.";
    case "room":
      return trimmed ? null : "Pick the room you have in mind.";
    default:
      return null;
  }
}

const FIELD_LABELS: Record<FieldName, string> = {
  name: "Your name",
  email: "Email",
  phone: "Phone",
  room: "The room",
  place: "Where it is",
  message: "Anything else",
};

export function ContactDocket({
  id,
  rooms,
}: {
  id?: string;
  rooms: RoomOption[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useState<FieldState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [sent, setSent] = useState(false);
  /**
   * Raised by a failed submit, consumed by the effect below. A ref rather
   * than state: it is a one-shot instruction to the DOM, not something the
   * render reads, and calling setState inside the effect that acts on it is
   * the cascading-render pattern `react-hooks/set-state-in-effect` exists
   * to stop.
   */
  const claimFocus = useRef(false);

  // Focus lands in an effect rather than in the submit handler, because at
  // the moment of submit the summary has not been rendered yet — and here
  // rather than in a requestAnimationFrame, because rAF is throttled to a
  // standstill in a background tab.
  useEffect(() => {
    if (!claimFocus.current) return;
    claimFocus.current = false;
    summaryRef.current?.focus();
  }, [errors]);

  const set = (field: FieldName) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear an error the moment it stops being true; re-checking every
    // keystroke of a field that was never wrong is what makes forms shout
    // at you while you are still typing the first half of your address.
    setErrors((current) => {
      if (!current[field]) return current;
      if (validate(field, value)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  // Validates the value carried by the event, not the one in state: a paste
  // followed straight by Tab, or a browser autofill, can set and blur a
  // field inside one tick, and the state this closure captured would still
  // be the empty string.
  const blur =
    (field: FieldName) =>
    (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const message = validate(field, event.target.value);
      setErrors((current) => {
        const next = { ...current };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
    };

  const answered = REQUIRED.filter((field) => !validate(field, values[field])).length;
  const errorList = (Object.keys(errors) as FieldName[]).filter((field) => errors[field]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const found: Partial<Record<FieldName, string>> = {};
    REQUIRED.forEach((field) => {
      const message = validate(field, values[field]);
      if (message) found[field] = message;
    });

    if (Object.keys(found).length) {
      setErrors(found);
      // The summary rather than the first bad field: the visitor gets the
      // whole list, and picks which to fix first.
      claimFocus.current = true;
      return;
    }

    // ── The mock ──
    // Replace with a POST to the API's enquiry endpoint. Everything around
    // it is already the behaviour a real submit wants.
    setSent(true);
    setValues(EMPTY);
    setErrors({});
    toast.success("Enquiry received — we will be in touch.");
  };

  useGSAP(sectionRef, (section, reduced) => {
    const sheet = section.querySelector<HTMLElement>("[data-sheet]");
    if (!sheet) return;

    if (reduced) {
      gsap.set(sheet, { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline({ paused: true });
    tl.from(sheet, { opacity: 0, y: 28, duration: 0.8, ease: EASE.editorial });

    ScrollTrigger.create({
      trigger: sheet,
      start: REVEAL_START,
      once: true,
      animation: tl,
    });

    return () => {
      tl.kill();
    };
  });

  // Two shapes, one control. Below `sm` the input is a ruled line — no box,
  // no fill, no radius — because a phone-width column of six bordered boxes
  // stacked one under another is the heaviest thing on the page and the
  // hardest to scan; a printed docket rules a line and writes on it. From
  // `sm`, where the fields pair up two to a row and read as fields rather
  // than as a stack, the bordered control returns.
  //
  // 16px on the mobile control, not 15: iOS Safari zooms the page in on
  // focus for anything smaller, and the zoom does not come back out.
  const inputClass =
    "w-full rounded-none border-0 border-b border-border/70 bg-transparent px-0 py-3 text-[16px] text-foreground transition-colors duration-200 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 sm:rounded-lg sm:border sm:border-border/80 sm:bg-background sm:px-4 sm:py-3.5 sm:text-[15px] sm:hover:border-enzo-sage sm:focus:border-primary";

  // Stays until another is asked for — a toast that has faded is
  // indistinguishable from a form that did nothing.
  const received = (
    <div role="status" className="py-2 sm:py-4">
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
        Received
      </span>
      <p
        className="mt-4 max-w-[20ch] font-title font-semibold leading-[1.1] tracking-[-0.03em] text-primary"
        style={{ fontSize: "clamp(1.6rem, 3.4vw, 2.4rem)" }}
      >
        That is with us.
      </p>
      <p className="mt-5 max-w-[46ch] text-[14.5px] leading-[1.7] text-muted-foreground">
        We read every enquiry ourselves — no call centre, no auto-responder
        that goes nowhere. You will hear from us the same working day, and we
        will offer two survey slots rather than asking you to guess at one.
      </p>
      <button
        type="button"
        onClick={() => setSent(false)}
        className="mt-8 w-full rounded-full border border-border px-6 py-3.5 text-[13.5px] text-primary transition-colors duration-300 hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
      >
        Send another
      </button>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="docket-heading"
      className="relative bg-card scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="docket-heading" className="sr-only">
          Send an enquiry
        </h2>

        {/* ── Fourth design: a rail and a column, not a card ──
            The third was one centred 54rem sheet with a forest header strip.
            On a 1500px page that is a business card floating in the middle
            of the section with a third of the width empty either side of it,
            and on a phone it is a bordered card inside a bordered section —
            two frames drawn around six more.

            So the section uses the page instead: a rail carrying the sheet
            mark, the statement and a checklist that ticks the three required
            answers off as they are filled, and the fields in their own
            column beside it. The rail is sticky, so what is left to answer
            stays on screen for the whole form rather than scrolling away
            with the heading. Below `lg` it all stacks and the checklist
            collapses back to the "0 of 3" counter on the mark rule — the
            same fact at a tenth of the height. */}
        <div
          data-sheet
          className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20"
        >
          {/* ── The rail ── */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex items-baseline gap-3 border-b border-border/70 pb-4">
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-forest-light">
                C2
              </span>
              <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.28em] text-primary/80">
                Enquiry
              </span>

              {/* A count and a shape, so it reads at a glance without being
                  a progress bar pretending the form is longer than it is.
                  Superseded by the named checklist from `lg`. */}
              <span className="ml-auto flex items-center gap-2.5 lg:hidden">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {answered} of {REQUIRED.length}
                </span>
                <span aria-hidden="true" className="flex gap-1.5">
                  {REQUIRED.map((field, index) => (
                    <span
                      key={field}
                      className={cn(
                        "h-2 w-2 rounded-[2px] transition-colors duration-500",
                        index < answered ? "bg-primary" : "bg-border",
                      )}
                    />
                  ))}
                </span>
              </span>
            </div>

            <p
              className="mt-7 font-title font-semibold leading-[1.1] tracking-[-0.035em] text-primary"
              style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.5rem)" }}
            >
              Three answers and we can start.
            </p>
            <p className="mt-4 max-w-[44ch] text-[14.5px] leading-[1.7] text-muted-foreground">
              Everything else is optional. Nothing here books anything, and
              nobody rings you unless you ask.
            </p>

            {/* The same three answers as the squares above, named and ticked
                — worth the room on a desk, where the rail is otherwise empty
                below the lede and stays in view for the whole form.
                `aria-hidden`: every tick restates a required field that
                already announces its own state to a screen reader, and the
                error summary is what actually reports what is missing. */}
            <ul className="mt-9 hidden lg:block" aria-hidden="true">
              {REQUIRED.map((field) => {
                const done = !validate(field, values[field]);
                return (
                  <li
                    key={field}
                    className="flex items-center gap-3 border-t border-border/60 py-3.5 last:border-b"
                  >
                    <span
                      className={cn(
                        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-300",
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {done && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span
                      className={cn(
                        "font-display text-[10.5px] font-semibold uppercase tracking-[0.2em] transition-colors duration-300",
                        done ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {FIELD_LABELS[field]}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="mt-7 hidden max-w-[38ch] text-[12.5px] leading-[1.7] text-muted-foreground lg:block">
              We survey before we quote — so this starts a visit, not a price.
            </p>
          </div>

          {/* ── The fields ── */}
          <div>
            {sent ? (
              received
            ) : (
              <form onSubmit={submit} noValidate>
                {errorList.length > 0 && (
                  <div
                    ref={summaryRef}
                    tabIndex={-1}
                    role="alert"
                    aria-labelledby="docket-error-title"
                    className="mb-8 rounded-lg border border-destructive/35 bg-destructive/[0.06] p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                  >
                    <p
                      id="docket-error-title"
                      className="font-display text-[10.5px] font-semibold uppercase tracking-[0.24em] text-destructive"
                    >
                      {errorList.length === 1
                        ? "One answer to finish"
                        : `${errorList.length} answers to finish`}
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {errorList.map((field) => (
                        <li key={field}>
                          <a
                            href={`#docket-${field}`}
                            className="text-[13.5px] text-foreground underline decoration-destructive/40 underline-offset-4 transition-colors hover:decoration-destructive"
                          >
                            {FIELD_LABELS[field]} — {errors[field]}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Short answers pair up from `sm`; on a phone they run down
                    the page one to a line, which is the only arrangement a
                    375px column has the width for. */}
                <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
                  <Field
                    id="docket-name"
                    label={FIELD_LABELS.name}
                    error={errors.name}
                    required
                  >
                    <input
                      id="docket-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={values.name}
                      onChange={(event) => set("name")(event.target.value)}
                      onBlur={blur("name")}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? "docket-name-error" : undefined}
                      placeholder="Priya Shah"
                      className={cn(inputClass, errors.name && "border-destructive/70")}
                    />
                  </Field>

                  <Field
                    id="docket-email"
                    label={FIELD_LABELS.email}
                    error={errors.email}
                    required
                  >
                    <input
                      id="docket-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={values.email}
                      onChange={(event) => set("email")(event.target.value)}
                      onBlur={blur("email")}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? "docket-email-error" : undefined}
                      placeholder="you@email.co.uk"
                      className={cn(inputClass, errors.email && "border-destructive/70")}
                    />
                  </Field>

                  <Field id="docket-phone" label={FIELD_LABELS.phone} hint="Only if you would rather we rang.">
                    <input
                      id="docket-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={values.phone}
                      onChange={(event) => set("phone")(event.target.value)}
                      placeholder="07XXX XXXXXX"
                      className={inputClass}
                    />
                  </Field>

                  <Field id="docket-place" label={FIELD_LABELS.place} hint="A town or a postcode is plenty.">
                    <input
                      id="docket-place"
                      name="place"
                      type="text"
                      autoComplete="address-level2"
                      value={values.place}
                      onChange={(event) => set("place")(event.target.value)}
                      placeholder="Oadby"
                      className={inputClass}
                    />
                  </Field>
                </div>

                {/* ── The room, as chips ──
                    Every option visible and each one its own target, rather
                    than a native select that opens an OS list on top of the
                    page. Real radios under the labels, so arrow keys and
                    screen readers get the group for free. */}
                <fieldset
                  id="docket-room"
                  className="mt-8 scroll-mt-28"
                  aria-describedby={errors.room ? "docket-room-error" : undefined}
                >
                  <legend className="font-display text-[10.5px] font-semibold uppercase tracking-[0.2em] text-foreground/70">
                    {FIELD_LABELS.room}
                    <span aria-hidden="true" className="ml-1.5 text-enzo-forest-light">
                      *
                    </span>
                  </legend>

                  <div className="mt-3.5 flex flex-wrap gap-2">
                    {rooms.map((room) => (
                      <div key={room.value}>
                        <input
                          type="radio"
                          id={`room-${room.value}`}
                          name="room"
                          value={room.value}
                          checked={values.room === room.value}
                          onChange={(event) => set("room")(event.target.value)}
                          className="peer sr-only"
                        />
                        <label
                          htmlFor={`room-${room.value}`}
                          className={cn(
                            "block cursor-pointer rounded-full border px-4 py-2.5 text-[13px] transition-colors duration-200 sm:px-5 sm:py-3 sm:text-[13.5px]",
                            "border-border/80 text-foreground/80 hover:border-enzo-sage hover:text-primary",
                            "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                            errors.room && "border-destructive/60",
                          )}
                        >
                          {room.label}
                        </label>
                      </div>
                    ))}
                  </div>

                  {errors.room && (
                    <p
                      id="docket-room-error"
                      role="alert"
                      className="mt-2.5 text-[12.5px] text-destructive"
                    >
                      {errors.room}
                    </p>
                  )}
                </fieldset>

                <div className="mt-8">
                  <Field
                    id="docket-message"
                    label={FIELD_LABELS.message}
                    hint="Rough sizes, a deadline, what the room is doing wrong now — whatever is useful."
                  >
                    <textarea
                      id="docket-message"
                      name="message"
                      rows={4}
                      value={values.message}
                      onChange={(event) => set("message")(event.target.value)}
                      placeholder="The kitchen is about 4 × 3 m and we would like it done before Christmas."
                      className={cn(inputClass, "resize-y")}
                    />
                  </Field>
                </div>

                {/* Button first in source from `sm` via flex-row-reverse, so
                    it sits at the right end of the rule where a submit
                    belongs, while a phone gets it directly under the last
                    field with the caveat beneath it. */}
                <div className="mt-9 flex flex-col gap-4 border-t border-border/70 pt-7 sm:flex-row-reverse sm:items-center sm:justify-between">
                  <button
                    type="submit"
                    className="w-full shrink-0 rounded-full bg-primary px-10 py-4 text-[14.5px] font-medium text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
                  >
                    Send enquiry
                  </button>
                  {/* The rail's copy of this line is hidden below `lg`, so
                      it reappears here — beside the button it qualifies. */}
                  <p className="text-[12.5px] leading-[1.6] text-muted-foreground lg:hidden">
                    We survey before we quote — so this starts a visit, not a
                    price.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Label above, control, then the hint or the error that replaces it. */
function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="scroll-mt-28">
      <label
        htmlFor={id}
        className="font-display block text-[10.5px] font-semibold uppercase tracking-[0.2em] text-foreground/70"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1.5 text-enzo-forest-light">
            *
          </span>
        )}
      </label>
      <div className="mt-2.5">{children}</div>
      {hint && !error && (
        <p className="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[12.5px] leading-[1.5] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
