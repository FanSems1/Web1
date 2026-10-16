"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  label: string;
  /** visually hidden instructions read with the button */
  hint: string;
  /** seconds of holding to reach 100% */
  duration?: number;
  /** "stay": remain complete until reset; "decay": wind down on release */
  afterComplete?: "stay" | "decay";
  onProgress: (p: number) => void;
  onComplete?: () => void;
  /** window event name that resets progress to 0 */
  resetEvent?: string;
  tone?: "ink" | "brass";
  /** "ring": minimal in-scene prompt (ring + caption), no pill */
  variant?: "pill" | "ring";
  icon?: ReactNode;
};

const R = 26;
const C = 2 * Math.PI * R;

/**
 * Press-and-hold control (pointer, touch, Space/Enter).
 * Progress runs in a rAF loop and is written straight to the DOM — no
 * React state per frame. Releasing early eases progress back to zero.
 */
export function HoldButton({
  label,
  hint,
  duration = 1.4,
  afterComplete = "decay",
  onProgress,
  onComplete,
  resetEvent,
  tone = "ink",
  variant = "pill",
  icon,
}: Props) {
  const hintId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const state = useRef({ p: 0, holding: false, done: false, raf: 0, last: 0 });
  const cb = useRef({ onProgress, onComplete });
  useEffect(() => {
    cb.current = { onProgress, onComplete };
  });

  useEffect(() => {
    const s = state.current;
    const paint = () => {
      if (ring.current) ring.current.style.strokeDashoffset = String(C * (1 - s.p));
      btn.current?.style.setProperty("--p", s.p.toFixed(3));
      btn.current?.setAttribute("data-state", s.done ? "done" : s.holding ? "holding" : "idle");
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      if (s.holding && !s.done) {
        // slight acceleration: feels like overcoming resistance
        s.p = Math.min(1, s.p + (dt / duration) * (0.75 + s.p * 0.6));
        if (s.p >= 1) {
          s.done = true;
          cb.current.onComplete?.();
        }
      } else if (!s.holding && (afterComplete === "decay" || !s.done)) {
        s.done = false;
        // ease back: proportional + small constant so it settles cleanly
        s.p = Math.max(0, s.p - dt * (s.p * 2.6 + 0.12));
      }
      cb.current.onProgress(s.p);
      paint();
      const settled = !s.holding && (s.p === 0 || (s.done && afterComplete === "stay"));
      s.raf = settled ? 0 : requestAnimationFrame(tick);
    };

    const start = () => {
      if (s.holding) return;
      s.holding = true;
      if (!s.raf) {
        s.last = performance.now();
        s.raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      if (!s.holding) return;
      s.holding = false;
      if (!s.raf) {
        s.last = performance.now();
        s.raf = requestAnimationFrame(tick);
      }
    };

    const el = btn.current!;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      start();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      if (e.type === "keydown" && !e.repeat) start();
      if (e.type === "keyup") stop();
    };
    const reset = () => {
      s.holding = false;
      s.done = false;
      s.p = 0;
      cb.current.onProgress(0);
      paint();
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    el.addEventListener("lostpointercapture", stop);
    el.addEventListener("keydown", key);
    el.addEventListener("keyup", key);
    el.addEventListener("blur", stop);
    if (resetEvent) window.addEventListener(resetEvent, reset);
    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", stop);
      el.removeEventListener("pointercancel", stop);
      el.removeEventListener("lostpointercapture", stop);
      el.removeEventListener("keydown", key);
      el.removeEventListener("keyup", key);
      el.removeEventListener("blur", stop);
      if (resetEvent) window.removeEventListener(resetEvent, reset);
    };
  }, [duration, afterComplete, resetEvent]);

  const brass = tone === "brass";

  if (variant === "ring") {
    return (
      <button
        ref={btn}
        type="button"
        aria-describedby={hintId}
        onContextMenu={(e) => e.preventDefault()}
        data-state="idle"
        className="group pointer-events-auto relative flex cursor-pointer select-none flex-col items-center gap-2 [-webkit-touch-callout:none] [touch-action:manipulation]"
      >
        <span className="relative grid size-16 place-items-center" aria-hidden="true">
          <span className="absolute inset-0 animate-[twb-pulse_2.2s_ease-out_infinite] rounded-full border-2 border-[var(--ink)] opacity-40 group-data-[state=holding]:animate-none" />
          <svg viewBox="0 0 60 60" className="absolute inset-0 size-full -rotate-90">
            <circle cx="30" cy="30" r={R} fill="var(--paper)" stroke="var(--ink)" strokeWidth="2.5" />
            <circle ref={ring} cx="30" cy="30" r={R} fill="none" stroke="var(--gold)" strokeWidth="5" strokeDasharray={C} strokeDashoffset={C} />
          </svg>
          <span className="relative text-[var(--ink)] transition-transform duration-200 group-data-[state=holding]:scale-90">{icon}</span>
        </span>
        <span className="cap whitespace-nowrap rounded-sm bg-[var(--paper)] px-2 py-0.5 text-[var(--ink)] shadow-[2px_2px_0_var(--ink)] outline outline-2 outline-[var(--ink)]">{label}</span>
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      </button>
    );
  }

  return (
    <button
      ref={btn}
      type="button"
      aria-describedby={hintId}
      onContextMenu={(e) => e.preventDefault()}
      data-state="idle"
      className={`group relative inline-flex min-h-14 cursor-pointer select-none items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5 text-[0.95rem] font-medium [-webkit-touch-callout:none] [touch-action:manipulation] transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] ${
        brass
          ? "bg-[#2B2A22] text-[#F6EBD6] hover:bg-[#363429]"
          : "bg-ink text-paper hover:bg-[#2f4441]"
      } shadow-[0_12px_34px_-14px_rgb(34_49_47/0.7)]`}
    >
      <span className="relative grid size-12 place-items-center" aria-hidden="true">
        <svg viewBox="0 0 60 60" className="absolute inset-0 size-full -rotate-90">
          <circle cx="30" cy="30" r={R} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
          <circle
            ref={ring}
            cx="30"
            cy="30"
            r={R}
            fill="none"
            stroke={brass ? "#E3B873" : "#D9AC70"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C}
          />
        </svg>
        <span className="grid size-8 place-items-center rounded-full bg-white/10 transition-transform duration-200 group-data-[state=holding]:scale-90">
          {icon}
        </span>
      </span>
      <span>{label}</span>
      <span id={hintId} className="sr-only">
        {hint}
      </span>
    </button>
  );
}
