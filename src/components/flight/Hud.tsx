"use client";

import { useEffect, useRef } from "react";
import { CHAPTERS } from "@/lib/chapters";
import { live, setCalm, setShared, useShared, writeCalmPreference } from "@/lib/experience";

/** our mark: a four-point spark, ink outline, gold fill */
export function Spark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M20 2c1.6 9.4 8.6 16.4 18 18-9.4 1.6-16.4 8.6-18 18-1.6-9.4-8.6-16.4-18-18 9.4-1.6 16.4-8.6 18-18Z" fill="var(--gold)" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Nearly invisible chrome, like a film title card: spark menu top-left,
 * chapter name + progress bottom-centre, index bottom-right, calm toggle
 * bottom-left.
 */
export function Hud() {
  const chapter = useShared((s) => s.chapter);
  const calm = useShared((s) => s.calm);
  const entered = useShared((s) => s.entered);
  const bar = useRef<HTMLSpanElement>(null);
  const c = CHAPTERS[chapter];

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = `scaleX(${(live.g / CHAPTERS.length).toFixed(3)})`;
      if (bar.current && bar.current.style.transform !== v) bar.current.style.transform = v;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`hud transition-opacity duration-700 ${entered ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <button type="button" className="hud-spark" aria-label="Open the index" onClick={() => setShared({ overlay: "index" })}>
        <Spark className="size-9 transition-transform duration-500 hover:rotate-45" />
      </button>

      <p className="hud-chapter cap" aria-hidden="true">
        <span className="text-[var(--gold-deep)]">{c.n}</span>
        <span className="mx-2 inline-block h-0.5 w-5 translate-y-[-3px] bg-[var(--ink)]" />
        {c.title}
        <span className="mt-2 block h-0.5 w-full overflow-hidden bg-[var(--ink)]/15">
          <span ref={bar} className="block h-full origin-left bg-[var(--ink)]" style={{ transform: "scaleX(0)" }} />
        </span>
      </p>

      <button type="button" className="hud-calm cap" aria-pressed={calm} onClick={() => (writeCalmPreference(!calm), setCalm(!calm))}>
        <span aria-hidden="true" className={`inline-block size-2.5 rounded-full border-2 border-[var(--ink)] ${calm ? "bg-[var(--ink)]" : ""}`} />
        Calm
      </button>

      <button type="button" className="hud-index cap" onClick={() => setShared({ overlay: "index" })}>
        Index
      </button>
    </div>
  );
}
