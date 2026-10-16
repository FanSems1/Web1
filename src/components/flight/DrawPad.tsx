"use client";

import { useEffect, useMemo, useRef } from "react";
import { live, stageApi } from "@/lib/experience";

/** the outline to trace: a paper plane, as one continuous stroke (viewBox units) */
const PTS: [number, number][] = [
  [8, 50],
  [92, 18],
  [60, 58],
  [92, 18],
  [44, 66],
  [36, 92],
  [32, 62],
  [8, 50],
];

function segments() {
  const segs = PTS.slice(1).map((b, i) => {
    const a = PTS[i];
    return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
  const total = segs.reduce((s, x) => s + x.len, 0);
  let acc = 0;
  return { segs: segs.map((s) => ({ ...s, start: (acc += s.len) - s.len })), total };
}

/**
 * Draw to bring it to life: trace the dotted outline with mouse or finger.
 * Progress only advances along the path in order (no scribbling shortcuts),
 * within a forgiving distance. "Draw it for me" does it for keyboard users.
 */
export function DrawPad({ onDone }: { onDone: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const ink = useRef<SVGPathElement>(null);
  const tip = useRef<SVGCircleElement>(null);
  const state = useRef({ p: 0, down: false, done: false, raf: 0 });
  const { segs, total } = useMemo(() => segments(), []);
  const d = useMemo(() => "M" + PTS.map((p) => p.join(" ")).join(" L"), []);
  const cb = useRef(onDone);
  useEffect(() => {
    cb.current = onDone;
  });

  const pointAt = (t: number): [number, number] => {
    const L = t * total;
    const s = segs.find((x) => L <= x.start + x.len) ?? segs[segs.length - 1];
    const f = Math.min(1, Math.max(0, (L - s.start) / s.len));
    return [s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f];
  };

  const paint = () => {
    const s = state.current;
    if (ink.current) ink.current.style.strokeDashoffset = String(1 - s.p);
    const [x, y] = pointAt(s.p);
    tip.current?.setAttribute("cx", String(x));
    tip.current?.setAttribute("cy", String(y));
    live.drawProgress = s.p;
    stageApi.invalidate();
  };

  const finish = () => {
    const s = state.current;
    if (s.done) return;
    s.done = true;
    s.p = 1;
    paint();
    live.drawDone = true;
    svg.current?.setAttribute("data-done", "true");
    cb.current();
  };

  // reset when the visitor comes back to an untouched page (e.g. after reload)
  useEffect(() => {
    live.drawProgress = 0;
    live.drawDone = false;
    paint();
    const s = state.current;
    return () => cancelAnimationFrame(s.raf);
    // paint only touches refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = (clientX: number, clientY: number) => {
    const s = state.current;
    if (!svg.current || s.done) return;
    const r = svg.current.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 100;
    const y = ((clientY - r.top) / r.height) * 100;
    // search only a little ahead of where the pen already is
    const from = s.p * total;
    let best = -1;
    for (const sg of segs) {
      if (sg.start + sg.len < from - 1 || sg.start > from + 18) continue;
      const vx = sg.b[0] - sg.a[0];
      const vy = sg.b[1] - sg.a[1];
      const f = Math.min(1, Math.max(0, ((x - sg.a[0]) * vx + (y - sg.a[1]) * vy) / (sg.len * sg.len)));
      const px = sg.a[0] + vx * f;
      const py = sg.a[1] + vy * f;
      const L = sg.start + f * sg.len;
      if (Math.hypot(x - px, y - py) < 9 && L > from && L < from + 18) best = Math.max(best, L);
    }
    if (best > 0) {
      s.p = Math.min(1, best / total);
      paint();
      if (s.p > 0.985) finish();
    }
  };

  const auto = () => {
    const s = state.current;
    if (s.done) return;
    const start = performance.now();
    const p0 = s.p;
    const step = (now: number) => {
      s.p = Math.min(1, p0 + (now - start) / 1400);
      paint();
      if (s.p >= 1) finish();
      else s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        ref={svg}
        viewBox="0 0 100 100"
        role="img"
        aria-label="A paper plane outline to trace"
        className="group size-[min(62vw,22rem)] cursor-crosshair touch-none select-none rounded-sm border-2 border-dashed border-[var(--ink)]/50 bg-[var(--paper)]/25"
        onPointerDown={(e) => {
          state.current.down = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          advance(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => state.current.down && advance(e.clientX, e.clientY)}
        onPointerUp={() => (state.current.down = false)}
        onPointerCancel={() => (state.current.down = false)}
      >
        <path d={d} fill="none" stroke="var(--ink)" strokeOpacity={0.55} strokeWidth={1.4} strokeDasharray="2 3" strokeLinecap="round" strokeLinejoin="round" />
        <path ref={ink} d={d} pathLength={1} fill="none" stroke="var(--ink)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1" strokeDashoffset="1" />
        <circle ref={tip} r={3.2} fill="var(--gold)" stroke="var(--ink)" strokeWidth={1.2} className="animate-[twb-blink_1.4s_ease-in-out_infinite] group-data-[done=true]:hidden" />
      </svg>
      <button type="button" className="ink-btn" onClick={auto}>
        Draw it for me
      </button>
    </div>
  );
}
