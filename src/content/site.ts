/**
 * All personal content lives here. Nothing in this file is real yet:
 * every value wrapped in `ph()` is a placeholder and is flagged in the UI
 * until you replace it. Never add experience, clients, metrics or awards
 * that are not true.
 */

export type Placeholder<T> = { value: T; placeholder: true };
type Field<T> = T | Placeholder<T>;

const ph = <T,>(value: T): Placeholder<T> => ({ value, placeholder: true });

export const read = <T,>(f: Field<T>): T =>
  typeof f === "object" && f !== null && "placeholder" in f ? f.value : (f as T);

export const isPlaceholder = (f: unknown): boolean =>
  typeof f === "object" && f !== null && "placeholder" in f;

export type SkillGroup = {
  id: string;
  title: string;
  summary: Field<string>;
  items: Field<string[]>;
};

export type Project = {
  slug: string;
  name: Field<string>;
  /** path in /public, or null to render the illustrated placeholder */
  screenshot: string | null;
  screenshotAlt: string;
  description: Field<string>;
  role: Field<string>;
  stack: Field<string[]>;
  /** Only verified outcomes. Leave empty if you cannot back them up. */
  outcomes: string[];
  liveUrl?: string;
  caseStudyUrl?: string;
  repoUrl?: string;
  /** visual motif for the gallery installation */
  motif: "arch" | "stair" | "window" | "tower";
};

export type ContactLink = {
  label: string;
  href: Field<string>;
  display: Field<string>;
};

export const site = {
  title: "The Worlds Between",
  tagline: "Every world begins with an idea.",

  person: {
    name: ph("Your Name"),
    title: ph("Creative Frontend Developer"),
    location: ph("City, Country"),
  },

  about: {
    lead: ph(
      "Replace this with a short, honest introduction — who you are and the kind of work you care about.",
    ),
    paragraphs: ph([
      "Describe how you approach building for the web: what you optimise for, how you collaborate, and what you enjoy most.",
      "Add a second paragraph about your background — where you've worked or studied, only as it really happened.",
    ]),
    facts: ph([
      { label: "Based in", value: "City, Country" },
      { label: "Focus", value: "Your focus area" },
      { label: "Currently", value: "Open to / working on …" },
    ]),
  },

  skills: [
    {
      id: "interface",
      title: "Interface engineering",
      summary: ph("What you build on the front end and how."),
      items: ph(["Skill one", "Skill two", "Skill three", "Skill four"]),
    },
    {
      id: "motion",
      title: "Motion & 3D",
      summary: ph("How you bring interfaces to life."),
      items: ph(["Skill one", "Skill two", "Skill three"]),
    },
    {
      id: "craft",
      title: "Quality & craft",
      summary: ph("Accessibility, performance, testing — the parts users feel."),
      items: ph(["Skill one", "Skill two", "Skill three"]),
    },
    {
      id: "tools",
      title: "Tools & platforms",
      summary: ph("Where your work runs and ships from."),
      items: ph(["Tool one", "Tool two", "Tool three"]),
    },
  ] satisfies SkillGroup[],

  projects: [
    {
      slug: "project-one",
      name: ph("Project One"),
      screenshot: null,
      screenshotAlt: "Screenshot placeholder for Project One",
      description: ph(
        "One or two sentences on what the project is and the problem it solves.",
      ),
      role: ph("Your role"),
      stack: ph(["Tech", "Tech", "Tech"]),
      outcomes: [],
      motif: "arch",
    },
    {
      slug: "project-two",
      name: ph("Project Two"),
      screenshot: null,
      screenshotAlt: "Screenshot placeholder for Project Two",
      description: ph(
        "One or two sentences on what the project is and the problem it solves.",
      ),
      role: ph("Your role"),
      stack: ph(["Tech", "Tech"]),
      outcomes: [],
      motif: "window",
    },
    {
      slug: "project-three",
      name: ph("Project Three"),
      screenshot: null,
      screenshotAlt: "Screenshot placeholder for Project Three",
      description: ph(
        "One or two sentences on what the project is and the problem it solves.",
      ),
      role: ph("Your role"),
      stack: ph(["Tech", "Tech", "Tech"]),
      outcomes: [],
      motif: "stair",
    },
    {
      slug: "project-four",
      name: ph("Project Four"),
      screenshot: null,
      screenshotAlt: "Screenshot placeholder for Project Four",
      description: ph(
        "One or two sentences on what the project is and the problem it solves.",
      ),
      role: ph("Your role"),
      stack: ph(["Tech", "Tech"]),
      outcomes: [],
      motif: "tower",
    },
  ] satisfies Project[],

  /** 02 — how you work: three short principles (shown in the Blueprint) */
  approach: ph([
    { title: "Principle one", text: "A sentence about how you start a project." },
    { title: "Principle two", text: "A sentence about how you shape and test ideas." },
    { title: "Principle three", text: "A sentence about how you finish and ship." },
  ]),

  /** 05 — your journey: work and education, only as it really happened (Observatory) */
  experience: ph([
    { role: "Role or study", org: "Company / school", period: "20XX — 20XX", summary: "One sentence on what you did there." },
    { role: "Role or study", org: "Company / school", period: "20XX — 20XX", summary: "One sentence on what you did there." },
    { role: "Role or study", org: "Company / school", period: "20XX — 20XX", summary: "One sentence on what you did there." },
    { role: "Role or study", org: "Company / school", period: "20XX — 20XX", summary: "One sentence on what you did there." },
  ]),

  contact: {
    intro: ph(
      "A sentence inviting people to reach out — the kind of work or collaboration you're open to.",
    ),
    links: [
      { label: "Email", href: ph("mailto:you@example.com"), display: ph("you@example.com") },
      { label: "GitHub", href: ph("https://github.com/your-handle"), display: ph("github.com/your-handle") },
      { label: "LinkedIn", href: ph("https://www.linkedin.com/in/your-handle"), display: ph("in/your-handle") },
    ] satisfies ContactLink[],
  },
};

/** true if any placeholder remains anywhere in the content */
export const hasPlaceholders = (): boolean => JSON.stringify(site).includes('"placeholder":true');
