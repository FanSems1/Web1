"use client";

import { CHAPTERS } from "@/lib/chapters";
import { useShared } from "@/lib/experience";
import { gearPath } from "@/lib/gear";

/**
 * Illustrated backdrops used when WebGL is unavailable or the context is
 * lost. Lightweight SVG/CSS — every chapter stays complete without 3D.
 */
export function Fallback() {
  const world = CHAPTERS[useShared((s) => s.chapter)].id;
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden transition-colors duration-700" data-fallback={world}>
      {world === "door" && (
        <div className="absolute inset-0 bg-ivory">
          <div className="absolute bottom-0 left-0 right-0 h-[38%] bg-[#EEE9DF]" />
          <div className="absolute bottom-[38%] left-1/2 -translate-x-1/2 md:left-[66%]">
            <div className="relative h-[46vh] w-[23vh] rounded-t-sm bg-[#E9E2D5] p-[1.6vh] shadow-[0_0_80px_10px_rgb(255_226_184/0.8)]">
              <div className="h-full w-full bg-[linear-gradient(180deg,#B9D9EE,#FCEBD0)]">
                <div className="h-full w-full origin-left bg-[#3E5F5C] shadow-[inset_0_0_0_6px_#365552]" />
              </div>
            </div>
          </div>
        </div>
      )}
      {world === "blueprint" && (
        <div className="absolute inset-0 bg-[#24467A] bg-[linear-gradient(rgb(255_255_255/0.12)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.12)_1px,transparent_1px)] bg-[size:40px_40px]" />
      )}
      {world === "observatory" && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#3a4385,#1E2550_60%)]">
          <div className="absolute inset-x-0 bottom-0 h-1/4 rounded-t-[50%] bg-[#2E3A6E]" />
        </div>
      )}
      {world === "city" && (
        <svg className="absolute inset-0 size-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="fb-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#BFDDF0" />
              <stop offset="1" stopColor="#FBF1E2" />
            </linearGradient>
          </defs>
          <rect width="1600" height="900" fill="url(#fb-sky)" />
          <g transform="translate(1050 430)">
            <path d="M-300 0 Q0 60 300 0 L120 230 Q0 280 -120 230Z" fill="#C9B7A0" />
            <rect x="-300" y="-24" width="600" height="30" rx="15" fill="#A8C98E" />
            {[-220, -150, -60, 20, 110, 190].map((x, i) => (
              <g key={x} transform={`translate(${x} ${-24})`}>
                <rect x="-26" y={-50 - (i % 3) * 18} width="52" height={50 + (i % 3) * 18} fill={["#F4EBDD", "#F2D7C6", "#D9E8EE"][i % 3]} />
                <path d={`M-32 ${-50 - (i % 3) * 18} L0 ${-84 - (i % 3) * 18} L32 ${-50 - (i % 3) * 18}Z`} fill={["#D9826B", "#7E9FB5", "#D9AC70"][i % 3]} />
              </g>
            ))}
          </g>
          {[[200, 700, 1.4], [700, 760, 1.8], [1300, 720, 1.5], [400, 200, 0.9]].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`} fill="#fff">
              <circle cx="-60" cy="10" r="50" />
              <circle cx="0" cy="-10" r="70" />
              <circle cx="70" cy="10" r="50" />
            </g>
          ))}
        </svg>
      )}
      {world === "reef" && (
        <svg className="absolute inset-0 size-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <rect width="1600" height="900" fill="#5FAFC4" />
          <rect y="700" width="1600" height="200" fill="#E8D4A8" />
          <path d={gearPath(1120, 420, 18, 180, 158, 50)} fill="#C9A36A" fillRule="evenodd" />
          <path d={gearPath(1370, 560, 12, 120, 104, 34)} fill="#B87D5B" fillRule="evenodd" />
          <path d={gearPath(900, 560, 10, 100, 86, 28)} fill="#9DB8B0" fillRule="evenodd" />
        </svg>
      )}
      {(world === "gallery" || world === "unfinished") && (
        <div className="absolute inset-0 bg-[#FBF8F2]">
          <div className="absolute bottom-0 h-1/3 w-full bg-[#F1ECE2]" />
          {[
            [62, 30, 10, 8, -8],
            [74, 22, 6, 6, 12],
            [82, 40, 8, 5, -4],
            [68, 50, 5, 9, 6],
          ].map(([l, t, w, h, r], i) => (
            <div
              key={i}
              className="absolute rounded-sm bg-[#E9E2D5] shadow-soft"
              style={{ left: `${l}%`, top: `${t}%`, width: `${w}vw`, height: `${h}vw`, rotate: `${r}deg` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
