"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { CHAPTERS } from "@/lib/chapters";
import {
  detectQuality,
  detectWebGL,
  getShared,
  live,
  readCalmPreference,
  setCalm,
  setShared,
  stageApi,
  useShared,
} from "@/lib/experience";
import { Driver } from "../flight/Driver";
import { Gate } from "../flight/Gate";
import { Hud } from "../flight/Hud";
import { Overlay } from "../flight/Overlay";
import { Fallback } from "./Fallback";

// three.js + R3F live in their own chunk, fetched only when WebGL is available
const Stage = dynamic(() => import("../stage/Stage"), { ssr: false });

const CITY = CHAPTERS.findIndex((c) => c.id === "city");
const SCOPE = CHAPTERS.findIndex((c) => c.id === "observatory");

export function Experience() {
  const webgl = useShared((s) => s.webgl);

  useEffect(() => {
    // fetch the 3D engine once the page itself has loaded
    let idleId = 0;
    const start = () => {
      const run = () => setShared({ webgl: detectWebGL(), quality: detectQuality() });
      const ric: (cb: () => void, o?: { timeout: number }) => number =
        window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idleId = ric(run, { timeout: 1000 });
    };
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });

    setCalm(readCalmPreference());
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => setCalm(readCalmPreference());
    mq.addEventListener("change", onMq);

    const fine = matchMedia("(pointer: fine)");
    const move = (e: PointerEvent) => {
      live.pointerX = (e.clientX / innerWidth) * 2 - 1;
      live.pointerY = -((e.clientY / innerHeight) * 2 - 1);
      live.pointerActive = fine.matches || e.pointerType !== "touch";
    };

    // drag to explore the city: any press on the scene itself (not on UI)
    let drag: { id: number; x: number; y: number; yaw: number; pitch: number; scope: boolean } | null = null;
    const isScene = (t: EventTarget | null) => t instanceof HTMLCanvasElement || t === document.body || t === document.documentElement;
    const down = (e: PointerEvent) => {
      const c = getShared().chapter;
      if ((c === CITY || c === SCOPE) && isScene(e.target) && e.button === 0) {
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: c === SCOPE ? live.scopeYaw : live.cityYaw, pitch: live.cityPitch, scope: c === SCOPE };
        document.documentElement.dataset.dragging = "true";
      }
      // touch: a tap in the last chapter gathers loose pieces
      if (getShared().chapter === CHAPTERS.length - 1 && e.pointerType !== "mouse") {
        live.pulseX = (e.clientX / innerWidth) * 2 - 1;
        live.pulseY = -((e.clientY / innerHeight) * 2 - 1);
        live.pulseAt = performance.now() / 1000;
      }
    };
    const dragMove = (e: PointerEvent) => {
      move(e);
      if (!drag || drag.id !== e.pointerId) return;
      if (drag.scope) {
        // turning the telescope: drag right to look right
        live.scopeYaw = Math.max(-1.4, Math.min(1.4, drag.yaw + (e.clientX - drag.x) * 0.003));
        return;
      }
      live.cityYaw = Math.max(-0.8, Math.min(0.8, drag.yaw - (e.clientX - drag.x) * 0.0035));
      live.cityPitch = Math.max(-0.12, Math.min(0.18, drag.pitch + (e.clientY - drag.y) * 0.0016));
      stageApi.invalidate();
    };
    const up = () => {
      drag = null;
      document.documentElement.dataset.dragging = "false";
    };
    addEventListener("pointerdown", down);
    addEventListener("pointermove", dragMove, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);

    return () => {
      removeEventListener("load", start);
      (window.cancelIdleCallback ?? window.clearTimeout)(idleId);
      mq.removeEventListener("change", onMq);
      removeEventListener("pointerdown", down);
      removeEventListener("pointermove", dragMove);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
    };
  }, []);

  // re-latch the door once the visitor has passed through it
  const chapter = useShared((s) => s.chapter);
  useEffect(() => {
    if (chapter > 0 && live.doorHold > 0) {
      live.doorHold = 0;
      window.dispatchEvent(new Event("twb:door-reset"));
    }
    document.documentElement.dataset.chapter = CHAPTERS[chapter].id;
  }, [chapter]);

  return (
    <>
      {webgl === true && <Stage />}
      {webgl === false && <Fallback />}
      <Driver />
      <Hud />
      <Overlay />
      <Gate />
    </>
  );
}
