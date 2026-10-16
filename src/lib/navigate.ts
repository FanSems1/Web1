"use client";

import { getShared } from "./experience";

/**
 * Scroll to a chapter and move focus to its heading so keyboard and
 * screen-reader users land in the right place. Smooth scrolling drives the
 * scrubbed transitions; calm mode jumps instantly.
 */
export function goTo(id: string, opts: { instant?: boolean } = {}) {
  const section = document.getElementById(id);
  if (!section) return;
  const instant = opts.instant || getShared().reducedMotion;
  section.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "start" });
  const heading = section.querySelector<HTMLElement>("h1, h2");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
  history.replaceState(null, "", `#${id}`);
}
