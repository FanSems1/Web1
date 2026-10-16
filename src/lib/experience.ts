"use client";

import { useSyncExternalStore } from "react";
import { CHAPTERS } from "./chapters";

/**
 * Per-frame values. Written by DOM handlers / scroll, read inside useFrame
 * and the DOM overlay loop. Never put these in React state.
 */
export const live = {
  /** raw scroll progress through each chapter, 0..1 */
  progress: CHAPTERS.map(() => 0),
  /** damped progress the camera actually follows */
  smooth: CHAPTERS.map(() => 0),
  /** 0..1 hold-to-open on the door */
  doorHold: 0,
  /** drag-to-explore target angles (radians) */
  cityYaw: 0,
  cityPitch: 0,
  /** 0..1 target reef "power" (lantern) while holding, and its eased value */
  reefTarget: 0,
  reefPower: 0,
  /** hovered gallery installation (-1 none) */
  hover: -1,
  /** normalised pointer (-1..1) */
  pointerX: 0,
  pointerY: 0,
  pointerActive: false,
  /** touch pulse for the unfinished world */
  pulseX: 0,
  pulseY: 0,
  pulseAt: -10,
  /** blueprint: 0..1 how much of the guide line the visitor has traced, and whether it took off */
  drawProgress: 0,
  drawDone: false,
  /** observatory: telescope aim offset from dragging (radians) */
  scopeYaw: 0,
  /** 0..1 "night dive" darkness in the reef (also flips the ink to glowing lines) */
  night: 0,
  /** true while the loader renders every world once off-screen */
  warming: false,
  /** damped global position along the whole flight, 0..CHAPTERS.length */
  g: 0,
  /** screen-space anchors written by the 3D scene for DOM prompts/labels (px) */
  anchors: new Map<string, { x: number; y: number; visible: boolean }>(),
};

/** set by the Stage; lets DOM handlers request a frame in on-demand mode */
export const stageApi = { invalidate: () => {} };

export type OverlayId = null | "index" | "approach" | "about" | "skills" | "journey" | "contact" | `project:${string}`;

type Shared = {
  /** chapter whose world is mounted (index into CHAPTERS) */
  chapter: number;
  quality: "high" | "low";
  reducedMotion: boolean;
  calm: boolean;
  webgl: boolean | null;
  /** how many of the five worlds have been built */
  worldsBuilt: number;
  /** warm-up stages finished: 1 = shaders compiled, +1 per world uploaded (max 6) */
  warmSteps: number;
  /** every world built, shaders compiled and geometry uploaded */
  warmed: boolean;
  compiling: boolean;
  stageLoaded: boolean;
  /** visitor has passed the opening gate */
  entered: boolean;
  overlay: OverlayId;
};

let shared: Shared = {
  chapter: 0,
  quality: "high",
  reducedMotion: false,
  calm: false,
  webgl: null,
  worldsBuilt: 0,
  warmSteps: 0,
  warmed: false,
  compiling: false,
  stageLoaded: false,
  entered: false,
  overlay: null,
};

const listeners = new Set<() => void>();

export function setShared(patch: Partial<Shared>) {
  let changed = false;
  for (const k in patch) {
    const key = k as keyof Shared;
    if (shared[key] !== patch[key]) changed = true;
  }
  if (!changed) return;
  shared = { ...shared, ...patch };
  listeners.forEach((l) => l());
}

export const getShared = () => shared;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot: Shared = { ...shared };

export function useShared<T>(select: (s: Shared) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(shared),
    () => select(serverSnapshot),
  );
}

export function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function detectQuality(): "high" | "low" {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = innerWidth < 820;
  const weakCpu = (nav.hardwareConcurrency ?? 8) <= 4;
  const weakMem = (nav.deviceMemory ?? 8) <= 4;
  return (coarse && small) || weakCpu || weakMem ? "low" : "high";
}

const MOTION_KEY = "twb:calm";

export function readCalmPreference(): boolean {
  try {
    return localStorage.getItem(MOTION_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCalmPreference(on: boolean) {
  try {
    localStorage.setItem(MOTION_KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable: preference lasts for this visit only */
  }
}

/** calm mode = the visitor's switch OR the OS reduced-motion preference */
export function setCalm(calm: boolean) {
  const os = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.dataset.calm = calm ? "true" : "false";
  setShared({ calm, reducedMotion: os || calm });
}

/** exponential damping that is frame-rate independent */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** 0→1 over [a,b], back to 0 over [c,d] */
export const window01 = (v: number, a: number, b: number, c: number, d: number) =>
  smoothstep(a, b, v) * (1 - smoothstep(c, d, v));
