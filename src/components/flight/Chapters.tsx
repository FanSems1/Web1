"use client";

import { read, site } from "@/content/site";
import { CHAPTERS, ci } from "@/lib/chapters";
import { live, setShared, stageApi } from "@/lib/experience";
import { HoldButton } from "../ui/HoldButton";
import { Txt } from "../ui/Txt";
import { scrollToChapter } from "./Driver";
import { DrawPad } from "./DrawPad";
import { ShardTitle } from "./ShardTitle";

const C = {
  door: ci("door"),
  blueprint: ci("blueprint"),
  city: ci("city"),
  cavern: ci("cavern"),
  observatory: ci("observatory"),
  gallery: ci("gallery"),
  unfinished: ci("unfinished"),
};

type Win = [number, number, number, number];

/** a piece of on-screen copy that fades with chapter progress */
function Beat({
  ch,
  win,
  className = "",
  anchor,
  children,
}: {
  ch: number;
  win: Win;
  className?: string;
  anchor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-beat
      data-ch={ch}
      data-win={win.join(",")}
      data-anchor={anchor}
      className={`beat ${anchor ? "beat-anchor" : ""} ${className}`}
      style={{ opacity: 0, visibility: "hidden" }}
    >
      {children}
    </div>
  );
}

/** words that slide up one after another when their beat turns on */
function Say({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`say ${className}`}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="say-w" style={{ transitionDelay: `${i * 28}ms` }}>
          {w}
        </span>
      ))}
    </span>
  );
}

function ResonateHold() {
  return (
    <HoldButton
      variant="ring"
      label="Hold to resonate"
      hint="Press and hold: the crystals hum, light leaps between them and the great gem opens. Purely decorative."
      duration={1.5}
      onProgress={(p) => {
        live.resonanceTarget = p;
        stageApi.invalidate();
      }}
      icon={
        <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
          <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="10" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      }
    />
  );
}

const open = (overlay: Parameters<typeof setShared>[0]["overlay"]) => () => setShared({ overlay });

function Section({ i, children }: { i: number; children: React.ReactNode }) {
  const c = CHAPTERS[i];
  const last = i === CHAPTERS.length - 1;
  return (
    <section
      id={`ch-${c.id}`}
      aria-labelledby={`title-${c.id}`}
      className="relative"
      style={{ height: `${(c.length + (last ? 1 : 0)) * 100}svh` }}
    >
      {children}
    </section>
  );
}

export function Chapters() {
  const facts = read(site.about.facts);
  return (
    <main id="main" className="pointer-events-none relative z-20">
      {/* 01 — THE FIRST DOOR */}
      <Section i={C.door}>
        <ShardTitle ch={C.door} as="h1" id="title-door" win={[-1, 0, 0.2, 0.34]} lines={["BEYOND THE", "ORDINARY."]} className="top-[9%] text-[clamp(2.8rem,8.6vw,8.4rem)]" />
        <Beat ch={C.door} win={[-1, 0, 0.24, 0.34]} className="corner-bl">
          <p className="say-lg mb-4">
            <Say text="I craft digital experiences worth exploring." />
          </p>
          <p className="cap">
            <Txt f={site.person.name} />
          </p>
          <p className="cap text-[var(--ink-soft)]">
            <Txt f={site.person.title} />
          </p>
        </Beat>
        {/* fixed on screen (not tied to the swaying 3D door) so it never drifts */}
        <Beat ch={C.door} win={[-1, 0, 0.2, 0.28]} className="corner-bc">
          <div>
            <HoldButton
              variant="ring"
              label="Hold to open"
              hint="Press and hold to open the door, or simply scroll down."
              duration={1.3}
              afterComplete="stay"
              resetEvent="twb:door-reset"
              onProgress={(p) => {
                live.doorHold = p;
                stageApi.invalidate();
              }}
              onComplete={() => setTimeout(() => scrollToChapter(C.blueprint, 0.03), 450)}
              icon={
                <svg viewBox="0 0 16 22" className="h-5 w-4" aria-hidden="true">
                  <rect x="1" y="1" width="14" height="20" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="11" cy="12" r="1.4" fill="currentColor" />
                </svg>
              }
            />
          </div>
        </Beat>
        <Beat ch={C.door} win={[-1, 0, 0.12, 0.2]} className="corner-br">
          <p className="cap flex flex-col items-center gap-2" aria-hidden="true">
            Scroll
            <span className="h-8 w-0.5 animate-[twb-drop_1.6s_ease-in-out_infinite] bg-[var(--ink)]" />
          </p>
        </Beat>
      </Section>

      {/* 02 — THE BLUEPRINT · approach */}
      <Section i={C.blueprint}>
        <ShardTitle ch={C.blueprint} id="title-blueprint" win={[0.03, 0.1, 0.2, 0.3]} lines={["THE", "BLUEPRINT"]} className="top-[30%] text-[clamp(2.8rem,9vw,8.4rem)]" />
        <Beat ch={C.blueprint} win={[0.2, 0.26, 0.7, 0.76]} className="corner-tl">
          <h3 className="cap mb-2 text-[var(--gold)]">How I work</h3>
          <p className="say-lg">
            <Say text="Every world begins as a sketch." />
          </p>
          <ol className="mt-4 hidden max-w-[17rem] gap-2 md:grid">
            {read(site.approach).map((a, k) => (
              <li key={k} className="tag-card">
                <p className="cap">
                  <span className="text-[var(--gold)]">{String(k + 1).padStart(2, "0")}</span> · <Txt f={{ value: a.title, placeholder: true }} />
                </p>
                <p className="mt-0.5 text-[0.8rem] leading-snug text-[var(--ink-soft)]">
                  <Txt f={{ value: a.text, placeholder: true }} />
                </p>
              </li>
            ))}
          </ol>
          <button type="button" onClick={open("approach")} className="ink-btn mt-4">
            My approach
          </button>
        </Beat>
        <Beat ch={C.blueprint} win={[0.3, 0.36, 0.66, 0.72]} className="draw-center">
          <p className="cap mb-3 text-center">Draw to bring it to life</p>
          <DrawPad onDone={() => setTimeout(() => scrollToChapter(C.blueprint, 0.8), 900)} />
        </Beat>
        <Beat ch={C.blueprint} win={[0.74, 0.78, 0.92, 0.97]} className="corner-bc">
          <p className="say-lg text-center">
            <Say text="Ideas take flight." />
          </p>
        </Beat>
      </Section>

      {/* 03 — THE FLOATING CITY · about */}
      <Section i={C.city}>
        <ShardTitle ch={C.city} id="title-city" win={[0.04, 0.12, 0.24, 0.34]} lines={["THE FLOATING", "CITY"]} className="top-[34%] text-[clamp(2.6rem,8.5vw,8rem)]" />
        <Beat ch={C.city} win={[0.32, 0.38, 0.62, 0.7]} className="corner-tl">
          <h3 className="cap mb-2 text-[var(--gold-deep)]">About</h3>
          <p className="say-lg">
            <Say text={read(site.about.lead)} />
          </p>
        </Beat>
        <Beat ch={C.city} win={[0.6, 0.66, 0.88, 0.95]} className="corner-tr text-right">
          {read(site.about.paragraphs).slice(0, 1).map((t, k) => (
            <p key={k} className="say-md">
              <Say text={t} />
            </p>
          ))}
        </Beat>
        <Beat ch={C.city} win={[0.36, 0.42, 0.9, 0.96]} className="corner-br text-right">
          <dl className="hidden gap-1.5 md:grid">
            {facts.map((f) => (
              <div key={f.label} className="flex justify-end gap-3">
                <dt className="cap text-[var(--ink-soft)]">{f.label}</dt>
                <dd className="cap">{f.value}</dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={open("about")} className="ink-btn mt-4">
            Read about me
          </button>
        </Beat>
        <Beat ch={C.city} win={[0.34, 0.4, 0.86, 0.92]} className="corner-bc">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Turn the city left" className="ink-icon" onClick={() => (live.cityYaw = Math.max(-0.8, live.cityYaw - 0.25))}>
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><path d="M12 5 7 10l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <p className="cap">Drag to explore</p>
            <button type="button" aria-label="Turn the city right" className="ink-icon" onClick={() => (live.cityYaw = Math.min(0.8, live.cityYaw + 0.25))}>
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </Beat>
      </Section>

      {/* 04 — THE CRYSTAL CAVERN · skills */}
      <Section i={C.cavern}>
        <ShardTitle ch={C.cavern} id="title-cavern" win={[0.04, 0.12, 0.24, 0.34]} lines={["THE CRYSTAL", "CAVERN"]} className="top-[34%] text-[clamp(2.6rem,8.5vw,8rem)]" />
        <Beat ch={C.cavern} win={[0.3, 0.36, 0.8, 0.86]} className="corner-tl">
          <h3 className="cap mb-2 text-[var(--gold-deep)]">Skills</h3>
          <p className="say-lg">
            <Say text="What I build with." />
          </p>
          <button type="button" onClick={open("skills")} className="ink-btn mt-4">
            All skills
          </button>
        </Beat>
        {site.skills.map((g, k) => (
          <Beat key={g.id} ch={C.cavern} anchor={`skill-${k}`} win={[0.32 + k * 0.03, 0.4 + k * 0.03, 0.76, 0.82]} className="desktop-only">
            <div className="anchor-offset -translate-x-1/2 -translate-y-[calc(100%+18px)]">
              <div className="tag-card w-max max-w-[15rem]">
                <p className="cap">{g.title}</p>
                <p className="mt-0.5 text-[0.78rem] leading-snug text-[var(--ink-soft)]">{read(g.items).join(" · ")}</p>
              </div>
            </div>
          </Beat>
        ))}
        <Beat ch={C.cavern} win={[0.32, 0.38, 0.76, 0.82]} className="corner-bl mobile-only">
          <div className="tag-card flex items-center gap-3">
            <ul className="flex flex-1 flex-wrap gap-1.5">
              {site.skills.map((g) => (
                <li key={g.id} className="chip">{g.title}</li>
              ))}
            </ul>
            <ResonateHold />
          </div>
        </Beat>
        {/* fixed on screen so it never drifts with the camera */}
        <Beat ch={C.cavern} win={[0.32, 0.38, 0.76, 0.82]} className="corner-br desktop-only">
          <ResonateHold />
        </Beat>
      </Section>

      {/* 05 — THE NIGHT OBSERVATORY · journey */}
      <Section i={C.observatory}>
        <ShardTitle ch={C.observatory} id="title-observatory" win={[0.03, 0.1, 0.17, 0.25]} lines={["THE NIGHT", "OBSERVATORY"]} className="top-[30%] text-[clamp(2.4rem,8vw,7.6rem)]" />
        <Beat ch={C.observatory} win={[0.2, 0.25, 0.84, 0.9]} className="corner-tl">
          <h3 className="cap mb-2 text-[var(--gold)]">My journey</h3>
          <p className="say-lg">
            <Say text="Every star, a chapter." />
          </p>
          <button type="button" onClick={open("journey")} className="ink-btn mt-4">
            Full journey
          </button>
        </Beat>
        {read(site.experience).map((e, k) => (
          <Beat key={k} ch={C.observatory} anchor={`exp-${k}`} win={[0.2, 0.25, 0.84, 0.9]} className="dock-mobile">
            <div className="anchor-offset md:-translate-x-1/2 md:translate-y-[24px]">
              <article className="tag-card w-[min(17rem,72vw)]">
                <p className="cap text-[var(--gold)]">
                  <Txt f={{ value: e.period, placeholder: true }} />
                </p>
                <h3 className="mt-1 font-[family-name:var(--font-title)] text-[1.35rem] font-black uppercase leading-none">
                  <Txt f={{ value: e.role, placeholder: true }} />
                </h3>
                <p className="cap mt-1 text-[var(--ink-soft)]">
                  <Txt f={{ value: e.org, placeholder: true }} />
                </p>
                <p className="mt-2 text-[0.85rem] leading-snug text-[var(--ink-soft)]">
                  <Txt f={{ value: e.summary, placeholder: true }} />
                </p>
              </article>
            </div>
          </Beat>
        ))}
        <Beat ch={C.observatory} win={[0.22, 0.28, 0.82, 0.88]} className="corner-bc desktop-only">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Turn the telescope left" className="ink-icon" onClick={() => (live.scopeYaw = Math.max(-1.4, live.scopeYaw - 0.32))}>
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><path d="M12 5 7 10l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <p className="cap">Drag to turn the telescope</p>
            <button type="button" aria-label="Turn the telescope right" className="ink-icon" onClick={() => (live.scopeYaw = Math.min(1.4, live.scopeYaw + 0.32))}>
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </Beat>
      </Section>

      {/* 06 — THE GALLERY OF WORLDS · work */}
      <Section i={C.gallery}>
        <ShardTitle ch={C.gallery} id="title-gallery" win={[0.03, 0.1, 0.17, 0.25]} lines={["THE GALLERY", "OF WORLDS"]} className="top-[34%] text-[clamp(2.6rem,8.5vw,8rem)]" />
        <Beat ch={C.gallery} win={[0.22, 0.27, 0.9, 0.96]} className="corner-tl">
          <h3 className="cap mb-2 text-[var(--gold-deep)]">Selected work</h3>
          <p className="say-lg">
            <Say text="Each installation is a project. Step inside." />
          </p>
        </Beat>
        {site.projects.map((p, k) => {
          const s = 0.24 + k * 0.17;
          return (
            <Beat key={p.slug} ch={C.gallery} anchor={`project-${k}`} win={[s, s + 0.04, s + 0.14, s + 0.18]} className="dock-mobile">
              <div className="anchor-offset md:translate-x-[28px] md:-translate-y-1/2">
                <article className="tag-card w-[min(19rem,70vw)]">
                  <p className="cap text-[var(--ink-soft)]">
                    {String(k + 1).padStart(2, "0")} · <Txt f={p.role} />
                  </p>
                  <h3 className="mt-1 font-[family-name:var(--font-title)] text-[1.6rem] font-black uppercase leading-none">
                    <Txt f={p.name} />
                  </h3>
                  <p className="mt-2 text-[0.85rem] leading-snug text-[var(--ink-soft)]">
                    <Txt f={p.description} />
                  </p>
                  <button type="button" onClick={open(`project:${p.slug}`)} className="ink-btn mt-3">
                    Discover
                  </button>
                </article>
              </div>
            </Beat>
          );
        })}
      </Section>

      {/* 07 — THE UNFINISHED WORLD · contact */}
      <Section i={C.unfinished}>
        <ShardTitle ch={C.unfinished} id="title-unfinished" win={[0.06, 0.2, 1.1, 1.2]} lines={["THE NEXT WORLD", "IS OURS TO BUILD."]} className="top-[14%] text-[clamp(2.4rem,7.5vw,7rem)]" />
        <Beat ch={C.unfinished} win={[0.3, 0.42, 1.1, 1.2]} className="corner-bl">
          <h3 className="cap mb-2 text-[var(--gold-deep)]">Contact</h3>
          <p className="say-md mb-4 max-w-[30ch]">
            <Say text={read(site.contact.intro)} />
          </p>
          <ul className="grid gap-1.5">
            {site.contact.links.map((l) => (
              <li key={l.label}>
                <a
                  href={read(l.href)}
                  {...(l.label !== "Email" && { target: "_blank", rel: "noreferrer" })}
                  className="contact-link"
                >
                  <span className="cap w-20 text-[var(--ink-soft)]">{l.label}</span>
                  <span className="truncate">
                    <Txt f={l.display} />
                  </span>
                  {l.label !== "Email" && <span className="sr-only"> (opens in a new tab)</span>}
                </a>
              </li>
            ))}
          </ul>
          {/* wrapper carries md:hidden: .ink-btn's display would override it */}
          <div className="mt-4 md:hidden">
            <button type="button" className="ink-btn" onClick={() => scrollToChapter(C.door, 0)}>
              Back to the first door
            </button>
          </div>
        </Beat>
        <Beat ch={C.unfinished} win={[0.3, 0.42, 1.1, 1.2]} className="corner-br hidden text-right md:block">
          <p className="cap hidden md:block" aria-hidden="true">
            Move to create
          </p>
          <p className="cap md:hidden" aria-hidden="true">
            Tap to build
          </p>
          <button type="button" className="ink-btn mt-3" onClick={() => scrollToChapter(C.door, 0)}>
            Back to the first door
          </button>
          <p className="mt-3 text-[0.75rem] text-[var(--ink-soft)]">
            © <Txt f={site.person.name} /> · {site.tagline}
          </p>
        </Beat>
      </Section>
    </main>
  );
}

