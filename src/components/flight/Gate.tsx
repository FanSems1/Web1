"use client";

import { useEffect, useState } from "react";
import { site } from "@/content/site";
import { setShared, useShared } from "@/lib/experience";
import { Spark } from "./Hud";

/** real loading stages: fonts, engine, 5 worlds built, shaders compiled, 5 worlds uploaded */
const TOTAL = 13;
/** the drawing never moves faster than this (progress per second) — pacing, not padding */
const MAX_RATE = 0.55;

/**
 * An ink sketch of the door, drawn stroke by stroke. `reveal` (0..1) maps
 * onto eight drawing passes, from the ground line to the light in the gaps.
 */
function DoorSketch({ reveal, seed, calm }: { reveal: number; seed: number; calm: boolean }) {
  const N = 8;
  const seg = (i: number) => {
    const t = Math.min(1, Math.max(0, reveal * N - i));
    return { strokeDasharray: 1, strokeDashoffset: 1 - t } as const;
  };
  const ink = { fill: "none", stroke: "var(--ink)", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const leafFill = Math.min(1, Math.max(0, reveal * N - 3.5));
  return (
    <svg viewBox="0 0 240 330" className="h-[min(52vh,30rem)] w-auto overflow-visible" aria-hidden="true">
      <defs>
        <filter id="boil" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={seed} />
          <feDisplacementMap in="SourceGraphic" scale={calm ? 0 : 2.6} />
        </filter>
      </defs>
      <g filter="url(#boil)">
        {/* 0 — ground and threshold */}
        <path pathLength={1} style={seg(0)} {...ink} strokeWidth={3.2} d="M8 314 H232 M40 300 H200 V314 H40 Z" />
        {/* 1 — jambs, with plinths */}
        <path pathLength={1} style={seg(1)} {...ink} strokeWidth={3.2} d="M52 300 V70 H72 V300 M168 300 V70 H188 V300 M46 300 V262 H78 V300 M162 300 V262 H194 V300" />
        {/* 2 — header, cornice and keystone */}
        <path pathLength={1} style={seg(2)} {...ink} strokeWidth={3.2} d="M44 70 V50 H196 V70 Z M30 50 V40 H210 V50 M36 40 V32 H204 V40 M108 70 V42 H132 V70" />
        {/* 3 — the leaf */}
        <path pathLength={1} style={seg(3)} {...ink} strokeWidth={3.4} fill="var(--door)" fillOpacity={leafFill} d="M76 298 V76 H164 V298 Z" />
        {/* 4 — raised panels */}
        <path pathLength={1} style={seg(4)} {...ink} strokeWidth={2.4} d="M86 88 H114 V176 H86 Z M126 88 H154 V176 H126 Z M86 192 H114 V268 H86 Z M126 192 H154 V268 H126 Z" />
        {/* 5 — hinges, knob, kick plate */}
        <path pathLength={1} style={seg(5)} {...ink} strokeWidth={2.4} d="M76 96 h-5 v14 h5 M76 186 h-5 v14 h5 M76 272 h-5 v14 h5 M84 282 H156 V292 H84 Z" />
        <circle cx="150" cy="200" r="5" {...ink} strokeWidth={2.4} fill="var(--gold)" fillOpacity={Math.min(1, Math.max(0, reveal * N - 5))} style={seg(5)} pathLength={1} />
        {/* 6 — hatching: shadows the way an illustrator would draw them */}
        <path
          pathLength={1}
          style={seg(6)}
          {...ink}
          strokeWidth={1.6}
          opacity={0.7}
          d="M188 90 l14 -14 M188 110 l14 -14 M188 130 l14 -14 M188 150 l14 -14 M188 170 l14 -14 M188 190 l14 -14 M188 210 l14 -14 M188 230 l14 -14 M188 250 l14 -14 M194 280 l10 -10 M194 296 l10 -10 M150 330 l18 -16 M172 330 l18 -16 M194 330 l18 -16 M216 328 l14 -12"
        />
        {/* 7 — light leaking around the leaf */}
        <path pathLength={1} style={seg(7)} fill="none" stroke="var(--gold)" strokeWidth={3} strokeLinecap="round" d="M74 298 V74 H166 V298" />
      </g>
    </svg>
  );
}

/**
 * Opening card. The door sketch draws itself while everything loads: fonts,
 * the 3D engine, all five worlds, every shader, every world's geometry. The
 * percentage counts real stages only. At 100% the sketch hands over to the
 * real 3D door; one click (or Enter) goes in.
 */
export function Gate() {
  const webgl = useShared((s) => s.webgl);
  const stageLoaded = useShared((s) => s.stageLoaded);
  const worldsBuilt = useShared((s) => s.worldsBuilt);
  const warmSteps = useShared((s) => s.warmSteps);
  const warmed = useShared((s) => s.warmed);
  const entered = useShared((s) => s.entered);
  const calm = useShared((s) => s.reducedMotion);
  const [fonts, setFonts] = useState(false);
  const [gone, setGone] = useState(false);
  const [shown, setShown] = useState(0);
  const [seed, setSeed] = useState(1);

  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => alive && setFonts(true));
    return () => {
      alive = false;
    };
  }, []);

  const done =
    webgl === false
      ? (fonts ? 1 : 0) + TOTAL - 1
      : (fonts ? 1 : 0) + (stageLoaded ? 1 : 0) + worldsBuilt + warmSteps;
  const target = Math.min(1, done / TOTAL);

  // the drawing follows real progress, never ahead of it, at a readable pace
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let boilAt = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setShown((s) => (s >= target ? target : Math.min(target, s + Math.max(dt * 0.08, Math.min(MAX_RATE * dt, (target - s) * dt * 4)))));
      if (now - boilAt > 125) {
        boilAt = now;
        setSeed((x) => (x % 7) + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const ready = shown >= 0.999 && fonts && (webgl === false || warmed);
  const with3d = ready && webgl === true;

  useEffect(() => {
    document.documentElement.style.overflow = entered ? "" : "hidden";
    document.documentElement.dataset.entered = entered ? "true" : "false";
    if (!entered) return;
    const t = setTimeout(() => setGone(true), 1400);
    return () => clearTimeout(t);
  }, [entered]);

  if (gone) return null;

  // the caption follows the drawing (which never runs ahead of real progress)
  const step = Math.floor(shown * TOTAL + 1e-6);
  const status =
    step < 1
      ? "Inking the first lines"
      : step < 2
        ? "Loading the engine"
        : step < 7
          ? `Building worlds · ${step - 1}/5`
          : step < 8
            ? "Compiling shaders"
            : step < 13
              ? `Polishing worlds · ${step - 7}/5`
              : "Ready";

  return (
    <div
      className={`gate fixed inset-0 z-[60] transition-[background-color,opacity,visibility] duration-[1200ms] ${
        entered ? "invisible opacity-0" : "opacity-100"
      } ${with3d ? "bg-transparent" : "bg-[var(--door-bg)]"}`}
    >
      <div className="absolute left-[clamp(1rem,3vw,2rem)] top-[clamp(1rem,3vw,1.75rem)] grid size-12 place-items-center" aria-hidden="true">
        <Spark className="size-9" />
      </div>

      <div className={`flex h-full flex-col items-center justify-center px-4 text-center transition-opacity duration-300 ${entered ? "opacity-0" : ""}`}>
        <button
          type="button"
          disabled={!ready}
          onClick={() => setShared({ entered: true })}
          aria-label={ready ? "Enter The Worlds Between" : `Preparing your experience, ${Math.round(shown * 100)} percent`}
          className="group relative grid cursor-pointer place-items-center disabled:cursor-progress"
        >
          <span className={`transition-opacity duration-[1200ms] ${with3d ? "opacity-0" : "opacity-100"}`}>
            <DoorSketch reveal={shown} seed={seed} calm={calm} />
          </span>
        </button>

        <div className="mt-6 min-h-[7.5rem]">
          {ready ? (
            <>
              <p className="gate-title animate-[twb-rise_700ms_cubic-bezier(.22,1,.36,1)]">{site.title}</p>
              <p className="cap mt-4 inline-flex items-center gap-3 rounded-sm bg-[var(--paper)] px-3 py-1.5 text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] outline outline-2 outline-[var(--ink)]">
                <span aria-hidden="true" className="size-2 animate-[twb-blink_1.4s_ease-in-out_infinite] rounded-full bg-[var(--gold-deep)]" />
                Click the door to enter
              </p>
            </>
          ) : (
            <p className="gate-percent" aria-hidden="true">
              {String(Math.round(shown * 100)).padStart(2, "0")}
              <span className="text-[0.45em]">%</span>
            </p>
          )}
        </div>
      </div>

      <p className="cap absolute bottom-[clamp(1rem,3vw,1.75rem)] left-[clamp(1rem,3vw,2rem)] text-[var(--ink)]" aria-live="polite">
        {ready ? "" : status}
      </p>
      <p className="cap absolute bottom-[clamp(1rem,3vw,1.75rem)] right-[clamp(1rem,3vw,2rem)] hidden text-[var(--ink-soft)] sm:block">{site.tagline}</p>

      <a
        href="#main"
        onClick={() => setShared({ entered: true })}
        className="cap sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:rounded focus:bg-[var(--paper)] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
    </div>
  );
}
