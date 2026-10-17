/**
 * The flight: seven chapters laid end to end. `length` is scroll distance in
 * viewport heights; scroll progress through each chapter drives its camera.
 * `bg` is the world's single dominant colour (also used for transitions).
 * `fog` and `light` are applied centrally so every world shares one light
 * setup — switching worlds never forces a shader recompile.
 * `dark` chapters use light ink on dark paper (blueprint, crystal cavern, night sky).
 */
export type ChapterId = "door" | "blueprint" | "city" | "cavern" | "observatory" | "gallery" | "unfinished";

export type Chapter = {
  id: ChapterId;
  n: string;
  title: string;
  label: string;
  length: number;
  bg: string;
  ink: string;
  dark?: boolean;
  fog: [number, number];
  light: { ambient: number; sun: number; pos: [number, number, number] };
};

const LIST: Omit<Chapter, "n">[] = [
  { id: "door", title: "The First Door", label: "Start", length: 3, bg: "#E8E0CF", ink: "#1D2624", fog: [16, 62], light: { ambient: 1.15, sun: 1.7, pos: [-4, 7, 6] } },
  { id: "blueprint", title: "The Blueprint", label: "Approach", length: 4, bg: "#24467A", ink: "#E6F0FF", dark: true, fog: [20, 72], light: { ambient: 1.25, sun: 1.3, pos: [-3, 10, 6] } },
  { id: "city", title: "The Floating City", label: "About", length: 4, bg: "#A9CBDC", ink: "#1C2A33", fog: [32, 95], light: { ambient: 1.2, sun: 1.6, pos: [7, 11, 5] } },
  { id: "cavern", title: "The Crystal Cavern", label: "Skills", length: 4, bg: "#24183F", ink: "#F1E6FF", dark: true, fog: [16, 58], light: { ambient: 0.95, sun: 1.15, pos: [3, 12, 6] } },
  { id: "observatory", title: "The Night Observatory", label: "Journey", length: 5, bg: "#1E2550", ink: "#E9E4FF", dark: true, fog: [26, 95], light: { ambient: 0.9, sun: 1.1, pos: [-6, 8, 5] } },
  { id: "gallery", title: "The Gallery of Worlds", label: "Work", length: 5, bg: "#D9A291", ink: "#2A1A16", fog: [13, 46], light: { ambient: 1.15, sun: 1.6, pos: [-5, 9, 4] } },
  { id: "unfinished", title: "The Unfinished World", label: "Contact", length: 3, bg: "#F2EEE6", ink: "#1D2624", fog: [22, 66], light: { ambient: 1.2, sun: 1.5, pos: [-4, 9, 6] } },
];

export const CHAPTERS: Chapter[] = LIST.map((c, i) => ({ ...c, n: String(i + 1).padStart(2, "0") }));

export const chapterIndex = (id: ChapterId) => CHAPTERS.findIndex((c) => c.id === id);
/** shorthand: index and chapter by id */
export const ci = chapterIndex;
export const ch = (id: ChapterId) => CHAPTERS[chapterIndex(id)];
