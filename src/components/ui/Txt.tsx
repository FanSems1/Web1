import { isPlaceholder, read, type Placeholder } from "@/content/site";

const DEV = process.env.NODE_ENV !== "production";

/** renders a content field; placeholders get a dashed outline in development */
export function Txt({ f }: { f: string | Placeholder<string> }) {
  const text = read(f);
  if (DEV && isPlaceholder(f)) {
    return (
      <span className="ph-flag" title="Placeholder — edit src/content/site.ts">
        {text}
      </span>
    );
  }
  return <>{text}</>;
}

export function ChapterLabel({ n, title }: { n: string; title: string }) {
  return (
    <p className="eyebrow flex items-center gap-3">
      <span className="text-gold-deep">Chapter {n}</span>
      <span aria-hidden="true" className="h-px w-8 bg-ink/25" />
      <span>{title}</span>
    </p>
  );
}
