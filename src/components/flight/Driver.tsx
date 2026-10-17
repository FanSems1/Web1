"use client";

import { useEffect, useRef } from "react";
import { CHAPTERS } from "@/lib/chapters";
import { damp, getShared, live, setShared, smoothstep, window01 } from "@/lib/experience";

type Beat = { el: HTMLElement; ch: number; win: [number, number, number, number]; anchor?: string; on: boolean };
type Shard = { el: HTMLElement; ch: number; win: [number, number, number, number]; from: number[]; to: number[] };

const parseWin = (s = "0,0,1.1,1.2") => s.split(",").map(Number) as [number, number, number, number];

/** where in the page each chapter starts, and how much scroll it spans */
function measure() {
  const vh = innerHeight;
  return CHAPTERS.map((c, i) => {
    const el = document.getElementById(`ch-${c.id}`)!;
    const top = el.offsetTop;
    const span = i === CHAPTERS.length - 1 ? Math.max(1, el.offsetHeight - vh) : el.offsetHeight;
    return { top, span };
  });
}

export function scrollToChapter(i: number, p = 0.02, instant = false) {
  const m = measure()[i];
  window.scrollTo({ top: m.top + m.span * p, behavior: instant || getShared().reducedMotion ? "auto" : "smooth" });
}

/**
 * The only per-frame DOM loop. Native scroll stays native; this turns it into
 * a damped global position `g`, picks the mounted chapter, runs the colour
 * wipe that hides world swaps, and positions beats, shard titles and labels.
 */
export function Driver() {
  const wipe = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let spans = measure();
    const onResize = () => (spans = measure());
    addEventListener("resize", onResize);

    const beats: Beat[] = [...document.querySelectorAll<HTMLElement>("[data-beat]")].map((el) => ({
      el,
      ch: +el.dataset.ch!,
      win: parseWin(el.dataset.win),
      anchor: el.dataset.anchor,
      on: false,
    }));
    const shards: Shard[] = [...document.querySelectorAll<HTMLElement>("[data-shard]")].map((el) => ({
      el,
      ch: +el.closest<HTMLElement>("[data-shard-title]")!.dataset.ch!,
      win: parseWin(el.closest<HTMLElement>("[data-shard-title]")!.dataset.win),
      from: el.dataset.from!.split(",").map(Number),
      to: el.dataset.to!.split(",").map(Number),
    }));
    const shardTitles = [...document.querySelectorAll<HTMLElement>("[data-shard-title]")];

    // keyboard users: focusing something in a hidden beat flies there first
    const onFocus = (e: FocusEvent) => {
      const beat = (e.target as HTMLElement).closest<HTMLElement>("[data-beat]");
      if (!beat || beat.dataset.on === "1") return;
      const [a, b, c] = parseWin(beat.dataset.win);
      scrollToChapter(+beat.dataset.ch!, Math.min(0.98, (b + Math.min(c, 1)) / 2 || a), true);
    };
    document.addEventListener("focusin", onFocus);

    // read the scroll position in the scroll event, never inside the frame loop:
    // reading scrollY after this loop's style writes forced a full synchronous layout
    let scrollPos = scrollY;
    const onScroll = () => (scrollPos = scrollY);
    addEventListener("scroll", onScroll, { passive: true });

    // write a style only when it actually changes
    const cache = new WeakMap<HTMLElement, Record<string, string>>();
    const put = (el: HTMLElement, prop: "opacity" | "visibility" | "transform", v: string) => {
      let c = cache.get(el);
      if (!c) cache.set(el, (c = {}));
      if (c[prop] === v) return;
      c[prop] = v;
      el.style[prop] = v;
    };

    const rawG = () => {
      const y = scrollPos;
      for (let i = CHAPTERS.length - 1; i >= 0; i--) {
        if (y >= spans[i].top || i === 0) return i + Math.min(1, Math.max(0, (y - spans[i].top) / spans[i].span));
      }
      return 0;
    };

    live.g = rawG();
    // the cover's own state: it snaps on instantly (to hide a swap) but always
    // releases over ~300ms, and its colour blends, so fast scrolling never strobes
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const cover = { op: 1, rgb: hex(CHAPTERS[0].bg) };
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { reducedMotion, chapter } = getShared();
      const raw = rawG();
      // long jumps (menu navigation) skip the worlds in between
      if (Math.abs(raw - live.g) > 1.2) live.g = raw - Math.sign(raw - live.g) * 0.12;
      live.g = damp(live.g, raw, reducedMotion ? 14 : 5, dt);
      const g = live.g;
      const n = CHAPTERS.length;
      for (let i = 0; i < n; i++) {
        live.smooth[i] = Math.min(1, Math.max(0, g - i));
        live.progress[i] = Math.min(1, Math.max(0, raw - i));
      }
      const idx = Math.min(n - 1, Math.floor(g));
      const swapped = idx !== chapter;
      if (swapped) setShared({ chapter: idx });

      // colour wipe: fully covers the screen whenever the world is swapping
      const f = g - idx;
      let op = 0;
      let color = CHAPTERS[idx].bg;
      if (idx < n - 1 && f > 0.9) {
        op = smoothstep(0.9, 0.975, f);
        color = CHAPTERS[idx + 1].bg;
      } else if (idx > 0 && f < 0.1) {
        op = 1 - smoothstep(0.02, 0.1, f);
      }
      if (!getShared().warmed && getShared().webgl) {
        op = 1;
        color = CHAPTERS[idx].bg;
      }
      // a swap is always hidden, even if one frame jumped straight past the cover window
      if (swapped) op = 1;
      cover.op = op >= cover.op ? op : damp(cover.op, op, 7, dt);
      const tgt = hex(color);
      // colour follows quickly while covered, so passing several worlds blends instead of stepping
      cover.rgb = cover.rgb.map((c, i) => (cover.op < 0.05 ? tgt[i] : damp(c, tgt[i], 10, dt)));
      if (wipe.current) {
        put(wipe.current, "opacity", cover.op.toFixed(3));
        const bgc = `rgb(${cover.rgb.map((c) => Math.round(c)).join(",")})`;
        if (wipe.current.dataset.bg !== bgc) {
          wipe.current.dataset.bg = bgc;
          wipe.current.style.backgroundColor = bgc;
        }
      }

      for (const b of beats) {
        const p = live.smooth[b.ch];
        let v = window01(p, ...b.win);
        if (b.ch !== idx && !(b.ch === idx - 1 && f < 0.02)) v = 0;
        let transform = "";
        if (b.anchor) {
          const a = live.anchors.get(b.anchor);
          if (!a || !a.visible) v = 0;
          else transform = `translate3d(${a.x.toFixed(0)}px, ${a.y.toFixed(0)}px, 0)`;
          if (v > 0) put(b.el, "transform", transform);
        }
        put(b.el, "opacity", v.toFixed(2));
        put(b.el, "visibility", v < 0.01 ? "hidden" : "visible");
        const on = v > 0.5;
        if (on !== b.on) {
          b.on = on;
          b.el.dataset.on = on ? "1" : "0";
        }
      }

      for (const t of shardTitles) {
        const ch = +t.dataset.ch!;
        const [a, b, c, d] = parseWin(t.dataset.win);
        const p = live.smooth[ch];
        const visible = ch === idx && p > a - 0.001 && p < d;
        put(t, "visibility", visible ? "visible" : "hidden");
        if (visible) {
          t.dataset.phase = p < b ? "in" : p < c ? "hold" : "out";
        }
      }
      for (const s of shards) {
        if (s.ch !== idx) continue;
        const p = live.smooth[s.ch];
        const [a, b, c, d] = s.win;
        const k = 1 - smoothstep(a, b, p); // still scattered
        const o = smoothstep(c, d, p); // tearing away
        if (reducedMotion) {
          put(s.el, "transform", "none");
          put(s.el, "opacity", (1 - Math.max(k, o)).toFixed(2));
          continue;
        }
        const x = s.from[0] * k + s.to[0] * o;
        const y = s.from[1] * k + s.to[1] * o;
        const r = s.from[2] * k + s.to[2] * o;
        put(s.el, "transform", k === 0 && o === 0 ? "none" : `translate3d(${x.toFixed(2)}em, ${y.toFixed(2)}em, 0) rotate(${r.toFixed(1)}deg)`);
        put(s.el, "opacity", Math.max(0, 1 - Math.max(k * 1.1, o * 1.2)).toFixed(2));
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);

  return <div ref={wipe} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[5] opacity-0" />;
}
