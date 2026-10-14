"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Honeypot } from "@/components/shared/Honeypot";
import { confirmSubscription, subscribe, unsubscribe, type NewsletterSource } from "@/lib/newsletter";
import type { SiteContent } from "@/lib/content";

type Labels = SiteContent["footer"]["newsletter"];
type LinkLabels = SiteContent["newsletter"];

/**
 * The newsletter sign-up, on a dark ground or (the coming-soon page) a light
 * one. The footer keeps its own drawing of the same form and calls the same
 * `subscribe`.
 */
export function NewsletterSignup({
  labels,
  source,
  tone = "dark",
}: {
  labels: Labels;
  source: NewsletterSource;
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [sentTo, setSentTo] = useState("");
  const [problem, setProblem] = useState("");
  const [before, after] = labels.thanks.split("{email}");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("sending");
    try {
      await subscribe(email, source, website);
      setSentTo(email.trim());
      setEmail("");
      setState("sent");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "");
      setState("failed");
    }
  };

  return (
    <form onSubmit={submit} className="relative max-w-md">
      <label htmlFor={`newsletter-${source}`} className={`font-display text-xs uppercase tracking-[0.22em] ${light ? "text-enzo-forest/70" : "text-enzo-sage"}`}>
        {labels.label}
      </label>
      <div className={`mt-3 flex items-center gap-2 border-b-2 pb-2 transition-colors ${light ? "border-enzo-forest/25 focus-within:border-enzo-forest" : "border-enzo-cream/20 focus-within:border-enzo-sand"}`}>
        <input
          id={`newsletter-${source}`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={labels.placeholder}
          className={`min-w-0 flex-1 bg-transparent py-2.5 text-[15px] focus:outline-none ${light ? "text-enzo-forest placeholder:text-enzo-forest/55" : "text-enzo-cream placeholder:text-enzo-cream/60"}`}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className={`min-h-11 shrink-0 rounded-full px-5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${light ? "bg-enzo-forest text-enzo-cream hover:bg-enzo-forest-light focus-visible:ring-enzo-forest" : "bg-enzo-sand text-enzo-forest hover:bg-enzo-sage focus-visible:ring-enzo-sand focus-visible:ring-offset-enzo-forest"}`}
        >
          {labels.submitLabel}
        </button>
      </div>
      <Honeypot value={website} onChange={setWebsite} />
      <p className="mt-3 min-h-5 text-[13px]" role="status">
        {state === "sent" ? (
          <span className={`flex items-center gap-2 ${light ? "text-enzo-charcoal/75" : "text-enzo-sage"}`}>
            <Check className={`h-4 w-4 shrink-0 ${light ? "text-enzo-forest" : "text-enzo-sand"}`} aria-hidden="true" />
            <span>
              {before}
              <span className={`font-medium ${light ? "text-enzo-forest" : "text-enzo-cream"}`}>{sentTo}</span>
              {after}
            </span>
          </span>
        ) : state === "failed" ? (
          <span className={light ? "text-enzo-forest" : "text-enzo-sand"}>{problem || (labels.error ?? "That did not go through. Try again.")}</span>
        ) : null}
      </p>
    </form>
  );
}

/** Which newsletter link this address is, if any. */
export function newsletterLink(pathname: string): "confirm" | "unsubscribe" | null {
  if (pathname === "/newsletter/confirm") return "confirm";
  if (pathname === "/newsletter/unsubscribe") return "unsubscribe";
  return null;
}

/**
 * What the links in the newsletter emails open: confirming happens as the
 * page loads, and unsubscribing asks first, so a mail scanner opening the
 * link cannot take anyone off the list. The token is read in the browser,
 * which is also what lets this run inside the coming-soon page before launch.
 */
export function NewsletterLinkAction({ mode, labels, tone = "dark" }: { mode: "confirm" | "unsubscribe"; labels: LinkLabels; tone?: "dark" | "light" }) {
  const [state, setState] = useState<"working" | "ask" | "confirmed" | "unsubscribed" | "gone" | "invalid">(
    mode === "confirm" ? "working" : "ask",
  );
  const token = useRef("");

  useEffect(() => {
    token.current = new URLSearchParams(window.location.search).get("token") ?? "";
    let cancelled = false;
    void (async () => {
      const next = !token.current
        ? "invalid"
        : mode === "confirm"
          ? ({ confirmed: "confirmed", unsubscribed: "gone", invalid: "invalid" } as const)[
              await confirmSubscription(token.current)
            ]
          : null;
      if (next && !cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const leave = async () => {
    setState("working");
    setState((await unsubscribe(token.current)) ? "unsubscribed" : "invalid");
  };

  const text = tone === "dark" ? "text-enzo-cream" : "text-primary";
  const muted = tone === "dark" ? "text-enzo-cream/75" : "text-muted-foreground";
  const message =
    state === "working"
      ? labels.confirming
      : state === "confirmed"
        ? labels.confirmed
        : state === "gone"
          ? labels.alreadyUnsubscribed
          : state === "unsubscribed"
            ? labels.unsubscribed
            : state === "invalid"
              ? labels.invalid
              : null;

  return (
    <div className="max-w-md space-y-4" role="status">
      {state === "ask" ? (
        <>
          <p className={`text-xl font-semibold ${text}`}>{labels.unsubscribeHeading}</p>
          <p className={`text-[15px] leading-relaxed ${muted}`}>{labels.unsubscribeBody}</p>
          <button
            type="button"
            onClick={() => void leave()}
            className="min-h-11 rounded-full bg-enzo-sand px-6 text-[14px] font-medium text-enzo-forest transition-colors hover:bg-enzo-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2"
          >
            {labels.unsubscribeButton}
          </button>
        </>
      ) : (
        <p className={`text-lg leading-relaxed ${text}`}>{message}</p>
      )}
    </div>
  );
}
