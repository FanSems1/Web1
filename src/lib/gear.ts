/** points of a gear outline around (0,0); trapezoid teeth */
export function gearPoints(teeth: number, outer: number, root: number): [number, number][] {
  const pts: [number, number][] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    pts.push(
      [Math.cos(a - step * 0.3) * root, Math.sin(a - step * 0.3) * root],
      [Math.cos(a - step * 0.16) * outer, Math.sin(a - step * 0.16) * outer],
      [Math.cos(a + step * 0.16) * outer, Math.sin(a + step * 0.16) * outer],
      [Math.cos(a + step * 0.3) * root, Math.sin(a + step * 0.3) * root],
    );
  }
  return pts;
}

export function gearPath(cx: number, cy: number, teeth: number, outer: number, root: number, hole = 0) {
  const pts = gearPoints(teeth, outer, root);
  let d = pts.map(([x, y], i) => `${i ? "L" : "M"}${(cx + x).toFixed(1)} ${(cy + y).toFixed(1)}`).join("") + "Z";
  if (hole > 0) {
    d += `M${cx + hole} ${cy}a${hole} ${hole} 0 1 0 ${-hole * 2} 0a${hole} ${hole} 0 1 0 ${hole * 2} 0Z`;
  }
  return d;
}

/** CSS clip-path polygon, percentages of the element box */
export function gearClip(teeth: number, outer = 50, root = 43) {
  return `polygon(${gearPoints(teeth, outer, root)
    .map(([x, y]) => `${(50 + x).toFixed(2)}% ${(50 + y).toFixed(2)}%`)
    .join(",")})`;
}
