import { rng } from "@/lib/random";

type Props = {
  ch: number;
  /** [scattered→, assembled, hold until, torn away] as chapter progress */
  win: [number, number, number, number];
  lines: string[];
  as?: "h1" | "h2";
  id?: string;
  className?: string;
  seed?: number;
};

/**
 * A chapter title made of torn paper strips. Each letter is cut into three
 * horizontal strips (clip-path) that drift in from scattered offsets,
 * assemble, then tear away again — all driven by scroll in <Driver>.
 * Screen readers get the plain text via aria-label.
 */
export function ShardTitle({ ch, win, lines, as: Tag = "h2", id, className = "", seed = 1 }: Props) {
  const r = rng(seed * 101 + ch);
  const text = lines.join(" ");
  return (
    <Tag
      id={id}
      aria-label={text}
      data-shard-title
      data-ch={ch}
      data-win={win.join(",")}
      className={`shard-title pointer-events-none fixed inset-x-0 z-20 px-4 text-center ${className}`}
      style={{ visibility: ch === 0 ? "visible" : "hidden" }}
    >
      {lines.map((line, li) => (
        <span key={li} aria-hidden="true" className="block whitespace-nowrap">
          {[...line].map((c, i) => {
            if (c === " ") return <span key={i} className="inline-block w-[0.28em]" />;
            const cut1 = 28 + r() * 16;
            const cut2 = 58 + r() * 16;
            const tilt = (r() - 0.5) * 10;
            const strips = [
              `polygon(-5% -5%, 105% -5%, 105% ${cut1 + tilt}%, -5% ${cut1 - tilt}%)`,
              `polygon(-5% ${cut1 - tilt}%, 105% ${cut1 + tilt}%, 105% ${cut2 - tilt}%, -5% ${cut2 + tilt}%)`,
              `polygon(-5% ${cut2 + tilt}%, 105% ${cut2 - tilt}%, 105% 105%, -5% 105%)`,
            ];
            return (
              <span key={i} className="relative inline-block">
                <span className="invisible">{c}</span>
                {strips.map((clip, k) => {
                  const from = [(r() - 0.5) * 2.4, (r() - 0.5) * 1.6 + (k - 1) * 0.5, (r() - 0.5) * 40];
                  const to = [(r() - 0.5) * 3 + (i - line.length / 2) * 0.12, -0.6 - r() * 1.4 + (k - 1) * 0.3, (r() - 0.5) * 50];
                  return (
                    <span
                      key={k}
                      data-shard
                      data-from={from.map((v) => v.toFixed(2)).join(",")}
                      data-to={to.map((v) => v.toFixed(2)).join(",")}
                      className="shard absolute inset-0"
                      style={{ clipPath: clip }}
                    >
                      {c}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
