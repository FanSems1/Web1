"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { read, site, type Project } from "@/content/site";
import { ch, CHAPTERS } from "@/lib/chapters";
import { setShared, useShared } from "@/lib/experience";
import { Txt } from "../ui/Txt";
import { scrollToChapter } from "./Driver";
import { Spark } from "./Hud";

function ProjectView({ p }: { p: Project }) {
  const links = [
    p.liveUrl && { href: p.liveUrl, label: "Visit live site" },
    p.caseStudyUrl && { href: p.caseStudyUrl, label: "Read case study" },
    p.repoUrl && { href: p.repoUrl, label: "View source" },
  ].filter(Boolean) as { href: string; label: string }[];
  return (
    <div className="grid gap-6 md:grid-cols-[1.15fr_1fr] md:gap-8">
      <div className="relative aspect-[16/10] overflow-hidden rounded-sm border-[3px] border-[var(--ink)] bg-[var(--gallery-bg)] shadow-[6px_6px_0_var(--ink)]">
        {p.screenshot ? (
          <Image src={p.screenshot} alt={p.screenshotAlt} fill sizes="(min-width:768px) 32rem, 100vw" className="object-cover" />
        ) : (
          <div role="img" aria-label={p.screenshotAlt} className="grid size-full place-items-center">
            <span className="cap text-[var(--ink-soft)]">Screenshot placeholder</span>
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <p className="cap text-[var(--ink-soft)]">
          <Txt f={p.role} />
        </p>
        <h2 id="overlay-title" className="ov-title mt-1">
          <Txt f={p.name} />
        </h2>
        <p className="mt-4 leading-relaxed">
          <Txt f={p.description} />
        </p>
        <h3 className="cap mt-6 text-[var(--ink-soft)]">Stack</h3>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {read(p.stack).map((s, i) => (
            <li key={i} className="chip">
              {s}
            </li>
          ))}
        </ul>
        {p.outcomes.length > 0 && (
          <>
            <h3 className="cap mt-6 text-[var(--ink-soft)]">Outcomes</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {p.outcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-auto pt-8">
          {links.length ? (
            <ul className="flex flex-wrap gap-2">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noreferrer" className="ink-btn">
                    {l.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cap text-[var(--ink-soft)]">No public link yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One native <dialog> for every detail view (focus trap + Esc for free).
 * The cinematic stays behind it; reading happens here.
 */
export function Overlay() {
  const overlay = useShared((s) => s.overlay);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const d = dialog.current!;
    if (overlay && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!overlay && d.open) d.close();
  }, [overlay]);

  const close = () => setShared({ overlay: null });
  const project = overlay?.startsWith("project:") ? site.projects.find((p) => `project:${p.slug}` === overlay) : undefined;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="overlay-title"
      onClose={() => {
        close();
        (opener.current as HTMLElement | null)?.focus?.();
      }}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
      className="overlay m-auto max-h-[90svh] w-[min(60rem,calc(100vw-1.5rem))] overflow-hidden p-0 open:animate-[twb-rise_380ms_cubic-bezier(.22,1,.36,1)]"
    >
      <div className="max-h-[90svh] overflow-y-auto p-6 md:p-10">
        {overlay === "index" && (
          <nav aria-labelledby="overlay-title">
            <h2 id="overlay-title" className="ov-title flex items-center gap-3">
              <Spark className="size-8" /> Index
            </h2>
            <ol className="mt-6 divide-y-2 divide-[var(--ink)]/10">
              {CHAPTERS.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="group flex w-full cursor-pointer items-baseline gap-4 py-3 text-left"
                    onClick={() => {
                      dialog.current?.close();
                      scrollToChapter(i, i === 0 ? 0 : 0.36, true);
                    }}
                  >
                    <span className="cap w-8 text-[var(--gold-deep)]">{c.n}</span>
                    <span className="font-[family-name:var(--font-title)] text-[clamp(1.4rem,3.5vw,2.2rem)] font-black uppercase leading-none transition-transform group-hover:translate-x-1">
                      {c.title}
                    </span>
                    <span className="cap ml-auto text-[var(--ink-soft)]">{c.label}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" className="ink-btn" onClick={() => setShared({ overlay: "approach" })}>Approach</button>
              <button type="button" className="ink-btn" onClick={() => setShared({ overlay: "about" })}>About</button>
              <button type="button" className="ink-btn" onClick={() => setShared({ overlay: "skills" })}>Skills</button>
              <button type="button" className="ink-btn" onClick={() => setShared({ overlay: "journey" })}>Journey</button>
              <button type="button" className="ink-btn" onClick={() => setShared({ overlay: "contact" })}>Contact</button>
            </div>
          </nav>
        )}

        {overlay === "approach" && (
          <article>
            <p className="cap text-[var(--gold-deep)]">{ch("blueprint").n} · {ch("blueprint").title}</p>
            <h2 id="overlay-title" className="ov-title mt-1">How I work</h2>
            <ol className="mt-6 grid gap-5 sm:grid-cols-3">
              {read(site.approach).map((a, k) => (
                <li key={k}>
                  <p className="cap text-[var(--gold-deep)]">{String(k + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 font-[family-name:var(--font-title)] text-xl font-black uppercase">
                    <Txt f={{ value: a.title, placeholder: true }} />
                  </h3>
                  <p className="mt-1 leading-relaxed">
                    <Txt f={{ value: a.text, placeholder: true }} />
                  </p>
                </li>
              ))}
            </ol>
          </article>
        )}

        {overlay === "journey" && (
          <article>
            <p className="cap text-[var(--gold-deep)]">{ch("observatory").n} · {ch("observatory").title}</p>
            <h2 id="overlay-title" className="ov-title mt-1">My journey</h2>
            <ol className="mt-6 grid gap-4 border-l-2 border-[var(--ink)]/20 pl-5">
              {read(site.experience).map((e, k) => (
                <li key={k}>
                  <p className="cap text-[var(--ink-soft)]">
                    <Txt f={{ value: e.period, placeholder: true }} />
                  </p>
                  <h3 className="font-[family-name:var(--font-title)] text-xl font-black uppercase leading-tight">
                    <Txt f={{ value: e.role, placeholder: true }} /> · <Txt f={{ value: e.org, placeholder: true }} />
                  </h3>
                  <p className="mt-1 leading-relaxed">
                    <Txt f={{ value: e.summary, placeholder: true }} />
                  </p>
                </li>
              ))}
            </ol>
          </article>
        )}

        {overlay === "about" && (
          <article>
            <p className="cap text-[var(--gold-deep)]">{ch("city").n} · {ch("city").title}</p>
            <h2 id="overlay-title" className="ov-title mt-1">About me</h2>
            <p className="mt-5 max-w-[60ch] text-lg leading-relaxed">
              <Txt f={site.about.lead} />
            </p>
            {read(site.about.paragraphs).map((t, k) => (
              <p key={k} className="mt-4 max-w-[60ch] leading-relaxed">
                <Txt f={{ value: t, placeholder: true }} />
              </p>
            ))}
            <dl className="mt-6 grid gap-4 border-t-2 border-[var(--ink)]/10 pt-5 sm:grid-cols-3">
              {read(site.about.facts).map((f) => (
                <div key={f.label}>
                  <dt className="cap text-[var(--ink-soft)]">{f.label}</dt>
                  <dd className="mt-1">{f.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        )}

        {overlay === "skills" && (
          <article>
            <p className="cap text-[var(--gold-deep)]">{ch("cavern").n} · {ch("cavern").title}</p>
            <h2 id="overlay-title" className="ov-title mt-1">Skills</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {site.skills.map((g) => (
                <section key={g.id}>
                  <h3 className="font-[family-name:var(--font-title)] text-xl font-black uppercase">{g.title}</h3>
                  <p className="mt-1 text-[var(--ink-soft)]">
                    <Txt f={g.summary} />
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {read(g.items).map((s, i) => (
                      <li key={i} className="chip">{s}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        )}

        {overlay === "contact" && (
          <article>
            <p className="cap text-[var(--gold-deep)]">{ch("unfinished").n} · {ch("unfinished").title}</p>
            <h2 id="overlay-title" className="ov-title mt-1">Contact</h2>
            <p className="mt-4 max-w-[55ch]">
              <Txt f={site.contact.intro} />
            </p>
            <ul className="mt-6 grid gap-2">
              {site.contact.links.map((l) => (
                <li key={l.label}>
                  <a href={read(l.href)} {...(l.label !== "Email" && { target: "_blank", rel: "noreferrer" })} className="contact-link">
                    <span className="cap w-20 text-[var(--ink-soft)]">{l.label}</span>
                    <Txt f={l.display} />
                  </a>
                </li>
              ))}
            </ul>
          </article>
        )}

        {project && <ProjectView p={project} />}
      </div>

      <form method="dialog" className="absolute right-3 top-3">
        <button type="submit" aria-label="Close" className="ink-icon size-11 bg-[var(--paper)]">
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </form>
    </dialog>
  );
}
