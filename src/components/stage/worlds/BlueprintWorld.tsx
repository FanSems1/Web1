"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CHAPTERS, ci } from "@/lib/chapters";
import { damp, getShared, live, smoothstep } from "@/lib/experience";
import { rng, useActiveFrame, useDisposable } from "../helpers";
import { fxLayer, toon } from "../ink";

const IDX = ci("blueprint");
const BG = new THREE.Color(CHAPTERS[IDX].bg);
const SKY = CHAPTERS[ci("city")].bg;
/** where the paper plane rests while it is being drawn, and the torn hole it escapes through */
const REST = new THREE.Vector3(0, 1.6, 0.6);
const HOLE = new THREE.Vector3(0, 3.2, -15);

/** blueprint paper: fine grid, a bold line every fifth, all in world units */
const gridVert = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const gridFrag = /* glsl */ `
varying vec3 vW;
uniform vec3 uBg;
uniform int uAxis;
float line(vec2 p, float s, float w) { vec2 f = abs(fract(p / s) - 0.5) * s; return 1.0 - smoothstep(0.0, w, min(f.x, f.y)); }
void main() {
  vec2 p = uAxis == 0 ? vW.xz : vW.xy;
  float fine = line(p, 0.5, 0.012);
  float bold = line(p, 2.5, 0.022);
  vec3 col = uBg;
  col = mix(col, vec3(0.70, 0.80, 0.95), fine * 0.28);
  col = mix(col, vec3(0.86, 0.92, 1.0), bold * 0.5);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}
`;

function useGridMaterial(axis: 0 | 1) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: gridVert,
        fragmentShader: gridFrag.replace("#include <fog_fragment>", ""),
        uniforms: { uBg: { value: BG.clone() }, uAxis: { value: axis } },
      }),
    [axis],
  );
  useDisposable([mat]);
  return mat;
}

/** the paper plane: drawn as lines while traced, then solid once it comes alive */
export function planeGeometry() {
  // a simple folded dart: nose, two wings, a keel
  const v = [
    [0, 0, -1.2], // nose
    [-0.95, 0.05, 0.75], // left wing tip
    [0, 0.05, 0.55], // tail centre
    [0.95, 0.05, 0.75], // right wing tip
    [0, -0.28, 0.6], // keel bottom
  ];
  const tri = [0, 1, 2, 0, 2, 3, 0, 2, 4];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tri.flatMap((i) => v[i]), 3));
  g.computeVertexNormals();
  return g;
}

function PaperPlane({ anchor }: { anchor: React.RefObject<THREE.Group | null> }) {
  const geo = useMemo(() => planeGeometry(), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 1), [geo]);
  const solid = useRef<THREE.MeshToonMaterial>(null);
  const lines = useRef<THREE.LineSegments>(null);
  const mesh = useRef<THREE.Mesh>(null);
  useDisposable([geo, edges]);
  const s = useRef({ alive: 0 });
  useFrame((_, d) => {
    if (getShared().chapter !== IDX) return;
    const dt = Math.min(d, 0.05);
    const p = live.smooth[IDX];
    // the line follows the visitor's pen; scrolling on also finishes the drawing
    const drawn = Math.max(live.drawProgress, smoothstep(0.66, 0.74, p));
    const count = edges.attributes.position.count;
    lines.current?.geometry.setDrawRange(0, Math.floor(count * drawn / 2) * 2);
    s.current.alive = damp(s.current.alive, live.drawDone || p > 0.74 ? 1 : 0, 3, dt);
    if (mesh.current) mesh.current.visible = s.current.alive > 0.02;
    if (solid.current) solid.current.opacity = s.current.alive;
    if (anchor.current) anchor.current.scale.setScalar(0.9 + s.current.alive * 0.1);
  });
  return (
    <group ref={anchor} position={REST}>
      <lineSegments ref={(el) => { lines.current = el; fxLayer(el); }} geometry={edges}>
        <lineBasicMaterial color="#FFFFFF" />
      </lineSegments>
      <mesh ref={mesh} geometry={geo} visible={false}>
        <meshToonMaterial ref={solid} color="#F4F8FF" side={THREE.DoubleSide} transparent opacity={0} />
      </mesh>
    </group>
  );
}

/** giant drafting tools lying on the sheet */
function Tools() {
  const m = useMemo(
    () => ({
      wood: toon("#F2C14E"),
      lead: toon("#2B2F3A"),
      eraser: toon("#F28C9B"),
      metal: toon("#C9D6EA"),
      ruler: toon("#9FC2EE", { transparent: true, opacity: 0.85 }),
      paper: toon("#F4F8FF"),
      mug: toon("#F27C5C"),
    }),
    [],
  );
  useDisposable(Object.values(m));
  const ruler = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(4, 0);
    s.lineTo(0, 2.6);
    s.closePath();
    const h = new THREE.Path();
    h.moveTo(0.6, 0.45);
    h.lineTo(2.3, 0.45);
    h.lineTo(0.6, 1.55);
    h.closePath();
    s.holes.push(h);
    return new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }).rotateX(-Math.PI / 2);
  }, []);
  const balls = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 5 }, () => ({ x: (r() - 0.5) * 10, z: -6 + r() * 7, s: 0.3 + r() * 0.25, rot: r() * 3 }));
  }, []);
  const crumple = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  useDisposable([ruler, crumple]);
  return (
    <>
      {/* pencil */}
      <group position={[-3.6, 0.22, 1.6]} rotation={[0, 0.6, Math.PI / 2]}>
        <mesh material={m.wood}>
          <cylinderGeometry args={[0.22, 0.22, 4.2, 6]} />
        </mesh>
        <mesh position-y={2.45} material={m.wood}>
          <coneGeometry args={[0.22, 0.7, 6]} />
        </mesh>
        <mesh position-y={2.75} material={m.lead}>
          <coneGeometry args={[0.07, 0.18, 6]} />
        </mesh>
        <mesh position-y={-2.25} material={m.metal}>
          <cylinderGeometry args={[0.23, 0.23, 0.3, 12]} />
        </mesh>
        <mesh position-y={-2.55} material={m.eraser}>
          <cylinderGeometry args={[0.22, 0.22, 0.35, 12]} />
        </mesh>
      </group>
      {/* triangle ruler */}
      <mesh geometry={ruler} material={m.ruler} position={[1.8, 0.05, 1.2]} rotation-y={-0.4} />
      {/* compass */}
      <group position={[3.6, 0, -2.2]}>
        <mesh position={[0, 1.4, 0]} material={m.metal}>
          <cylinderGeometry args={[0.12, 0.12, 0.35, 12]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.45, 0.7, 0]} rotation-z={s * 0.35} material={m.metal}>
            <cylinderGeometry args={[0.05, 0.03, 1.5, 8]} />
          </mesh>
        ))}
      </group>
      {/* a mug, of course */}
      <group position={[-2.6, 0, -3.4]}>
        <mesh position-y={0.55} material={m.mug}>
          <cylinderGeometry args={[0.5, 0.45, 1.1, 20, 1, true]} />
        </mesh>
        <mesh position={[0.55, 0.6, 0]} material={m.mug}>
          <torusGeometry args={[0.25, 0.07, 8, 16]} />
        </mesh>
      </group>
      {balls.map((b, i) => (
        <mesh key={i} geometry={crumple} material={m.paper} position={[b.x, b.s * 0.8, b.z]} rotation={[b.rot, b.rot * 2, 0]} scale={b.s} />
      ))}
    </>
  );
}

/** faint construction drawings of ideas: boxes, arches, a tower — just white lines */
function Sketches() {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number) => {
      const e = new THREE.EdgesGeometry(g);
      e.translate(x, y, z);
      parts.push(e);
      g.dispose();
    };
    add(new THREE.BoxGeometry(1.4, 1.2, 1.4), -4.8, 0.6, -5.5);
    add(new THREE.ConeGeometry(1.1, 0.9, 4), -4.8, 1.65, -5.5);
    add(new THREE.CylinderGeometry(0.6, 0.6, 2.6, 10, 3), 5, 1.3, -6.5);
    add(new THREE.BoxGeometry(2.4, 0.8, 1.2), 0.5, 0.4, -7.5);
    add(new THREE.TorusGeometry(1.2, 0.02, 4, 24, Math.PI), -0.8, 0.0, -9);
    const pos = parts.flatMap((p) => [...(p.attributes.position.array as Float32Array)]);
    parts.forEach((p) => p.dispose());
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return out;
  }, []);
  useDisposable([geo]);
  return (
    <lineSegments ref={fxLayer} geometry={geo}>
      <lineBasicMaterial color="#CFE0FA" transparent opacity={0.55} />
    </lineSegments>
  );
}

/** a standing sheet with a torn hole: the sky of the next world shows through */
function TornSheet() {
  const mat = useGridMaterial(1);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-14, -2);
    s.lineTo(14, -2);
    s.lineTo(14, 14);
    s.lineTo(-14, 14);
    s.closePath();
    const r = rng(4);
    const hole = new THREE.Path();
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rad = 1.7 + (r() - 0.5) * 0.7;
      const x = HOLE.x + Math.cos(a) * rad * 1.15;
      const y = HOLE.y + Math.sin(a) * rad;
      if (i === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    s.holes.push(hole);
    return new THREE.ShapeGeometry(s);
  }, []);
  useDisposable([geo]);
  return (
    <group position-z={HOLE.z}>
      <mesh geometry={geo} material={mat} />
      <mesh ref={fxLayer} position={[HOLE.x, HOLE.y, -0.4]}>
        <planeGeometry args={[7, 6]} />
        <meshBasicMaterial color={SKY} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function BlueprintWorld() {
  const floor = useGridMaterial(0);
  const plane = useRef<THREE.Group>(null);
  const k = useRef({ ox: 0, oy: 0, v: new THREE.Vector3(), look: new THREE.Vector3(), flight: new THREE.Vector3() });
  const path = useMemo(() => new THREE.CatmullRomCurve3([REST.clone(), new THREE.Vector3(0.4, 3.4, -3), new THREE.Vector3(-0.3, 3.4, -9), HOLE.clone().add(new THREE.Vector3(0, 0, -3))]), []);

  useActiveFrame(IDX, 40, 90, (state, dt) => {
    const p = live.smooth[IDX];
    const calm = getShared().reducedMotion;
    const s = k.current;
    s.ox = damp(s.ox, calm ? 0 : live.pointerX * 0.25, 2.5, dt);
    s.oy = damp(s.oy, calm ? 0 : live.pointerY * 0.12, 2.5, dt);
    const cam = state.camera;

    // the plane takes off after it's drawn, then leads the camera out through the hole
    const fly = smoothstep(0.76, 1, p);
    path.getPointAt(fly, s.flight);
    if (plane.current) {
      plane.current.position.copy(s.flight);
      plane.current.position.y += calm ? 0 : Math.sin(state.clock.elapsedTime * 1.4) * 0.06 * (1 - fly);
      plane.current.rotation.set(-0.15 - fly * 0.1, 0, Math.sin(state.clock.elapsedTime * 0.9) * 0.08);
    }

    // arrive looking down at the sheet (0–.16) · hover over the drawing (.16–.76) · follow the plane
    const arrive = smoothstep(0, 0.16, p);
    s.v.set(THREE.MathUtils.lerp(0, 0, arrive), THREE.MathUtils.lerp(9, 3.6, arrive), THREE.MathUtils.lerp(3, 5.4, arrive));
    s.look.set(0, THREE.MathUtils.lerp(0, 1.4, arrive), THREE.MathUtils.lerp(-1, 0, arrive));
    if (fly > 0) {
      const f = fly * fly * (3 - 2 * fly);
      s.v.lerp(s.flight.clone().add(new THREE.Vector3(0, 0.7, 3.2)), f);
      s.look.lerp(s.flight.clone().add(new THREE.Vector3(0, 0, -4)), f);
    }
    cam.position.set(s.v.x + s.ox, s.v.y + s.oy, s.v.z);
    cam.lookAt(s.look);
  });

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-z={-6} material={floor}>
        <planeGeometry args={[120, 120]} />
      </mesh>
      <Tools />
      <Sketches />
      <PaperPlane anchor={plane} />
      <TornSheet />
    </>
  );
}
