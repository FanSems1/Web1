"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CHAPTERS, ci } from "@/lib/chapters";
import { damp, getShared, live, smoothstep } from "@/lib/experience";
import { BakedShadow, easeInCubic, easeInOutCubic, fly, rng, useAnchorCleanup, useDisposable, useFlight, useGlowTexture, useActiveFrame, writeAnchor } from "../helpers";
import { fxLayer, toon } from "../ink";

const IDX = ci("door");
/** what waits beyond the door: the blueprint */
const BEYOND = CHAPTERS[ci("blueprint")].bg;

const W = 1.3;
const H = 2.6;
const BASE = 0.1;

// the world beyond: flat sky and cel clouds — what the camera flies into
const portalFrag = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec3 uSky;
void main() {
  // a blueprint sheet: fine grid, bold every fifth line, a sketched arc
  vec2 g = vUv * vec2(13.0, 26.0);
  vec2 f = abs(fract(g) - 0.5);
  float fine = step(0.46, max(f.x, f.y));
  vec2 G = vUv * vec2(13.0, 26.0) / 5.0;
  vec2 F = abs(fract(G) - 0.5);
  float bold = step(0.475, max(F.x, F.y));
  float arc = 1.0 - smoothstep(0.0, 0.012, abs(length((vUv - vec2(0.5, 0.35)) * vec2(1.0, 2.0)) - 0.32 - 0.01 * sin(uTime)));
  vec3 col = uSky;
  col = mix(col, vec3(0.72, 0.82, 0.95), fine * 0.35);
  col = mix(col, vec3(0.85, 0.91, 1.0), bold * 0.55);
  col = mix(col, vec3(1.0), arc * 0.9);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

function archGeometry(w: number, h: number, openW: number, openH: number, arched: boolean, depth: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.closePath();
  const hole = new THREE.Path();
  const r = openW / 2;
  hole.moveTo(-r, 0);
  if (arched) {
    hole.lineTo(-r, openH - r);
    hole.absarc(0, openH - r, r, Math.PI, 0, true);
    hole.lineTo(r, 0);
  } else {
    hole.lineTo(-r, openH);
    hole.lineTo(r, openH);
    hole.lineTo(r, 0);
  }
  hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function Door({ pivot, knob }: { pivot: React.RefObject<THREE.Group | null>; knob: React.RefObject<THREE.Mesh | null> }) {
  const m = useMemo(
    () => ({
      brass: toon("#E3B25C"),
      stone: toon("#F4EFE4"),
      stoneDark: toon("#E2D8C3"),
      wood: toon("#2F5D58"),
      panel: toon("#3B6E68"),
    }),
    [],
  );
  useDisposable(Object.values(m));
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSky: { value: new THREE.Color(BEYOND) } }), []);
  const portal = useRef<THREE.ShaderMaterial>(null);
  useFrame((s) => {
    if (portal.current) portal.current.uniforms.uTime.value = getShared().reducedMotion ? 0 : s.clock.elapsedTime;
  });

  const jambX = W / 2 + 0.09;
  const panelW = W - 0.045;
  const panelH = H - 0.025;
  const panels: [number, number, number, number][] = [
    [-0.29, 0.64, 0.44, 0.78],
    [0.29, 0.64, 0.44, 0.78],
    [-0.29, 1.78, 0.44, 1.06],
    [0.29, 1.78, 0.44, 1.06],
  ];

  return (
    <group>
      <RoundedBox args={[2.2, BASE, 0.95]} radius={0.03} smoothness={2} position={[0, BASE / 2, 0.08]} material={m.stoneDark} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * jambX, 0, 0]}>
          <RoundedBox args={[0.18, H + 0.1, 0.34]} radius={0.02} smoothness={2} position={[0, BASE + (H + 0.1) / 2, 0]} material={m.stone} />
          <RoundedBox args={[0.24, 0.32, 0.4]} radius={0.02} smoothness={2} position={[0, BASE + 0.16, 0]} material={m.stoneDark} />
        </group>
      ))}
      <RoundedBox args={[W + 0.36, 0.2, 0.36]} radius={0.02} smoothness={2} position={[0, BASE + H + 0.1, 0]} material={m.stone} />
      <RoundedBox args={[W + 0.6, 0.07, 0.46]} radius={0.02} smoothness={2} position={[0, BASE + H + 0.235, 0]} material={m.stoneDark} />
      <RoundedBox args={[0.2, 0.26, 0.4]} radius={0.02} smoothness={2} position={[0, BASE + H + 0.08, 0.01]} material={m.stoneDark} />

      <mesh position={[0, BASE + H / 2, -0.06]}>
        <planeGeometry args={[W + 0.04, H + 0.04]} />
        <shaderMaterial
          ref={portal}
          vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
          fragmentShader={portalFrag}
          uniforms={uniforms}
        />
      </mesh>

      <group ref={pivot} position={[-W / 2 + 0.005, BASE + 0.01, 0]}>
        <group position={[panelW / 2, panelH / 2, 0]}>
          <RoundedBox args={[panelW, panelH, 0.07]} radius={0.012} smoothness={2} material={m.wood} />
          {[1, -1].map((face) =>
            panels.map(([x, y, w, h], i) => (
              <RoundedBox key={`${face}-${i}`} args={[w, h, 0.02]} radius={0.008} smoothness={2} position={[x, y - panelH / 2, face * 0.042]} material={m.panel} />
            )),
          )}
          {[1, -1].map((face) => (
            <mesh key={face} position={[0, -panelH / 2 + 0.09, face * 0.037]} material={m.brass}>
              <boxGeometry args={[panelW - 0.12, 0.1, 0.008]} />
            </mesh>
          ))}
          {[1, -1].map((face) => (
            <group key={face} position={[panelW / 2 - 0.13, -0.17, face * 0.05]}>
              <mesh position={[0, 0, face * 0.035]} material={m.brass} ref={face === 1 ? knob : undefined}>
                <sphereGeometry args={[0.048, 20, 14]} />
              </mesh>
              <mesh rotation-x={Math.PI / 2} material={m.brass}>
                <cylinderGeometry args={[0.05, 0.055, 0.02, 20]} />
              </mesh>
            </group>
          ))}
        </group>
        {[0.3, 1.3, 2.3].map((y) => (
          <mesh key={y} position={[0, y, 0.03]} material={m.brass}>
            <cylinderGeometry args={[0.02, 0.02, 0.16, 10]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** the endless hall: arches, empty frames, stairs to nowhere */
function Hall() {
  const arch = useMemo(() => archGeometry(2.6, 4.4, 1.5, 3.2, true, 0.55), []);
  const frame = useMemo(() => archGeometry(1.7, 3.0, 1.3, 2.6, false, 0.28), []);
  const step = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(() => toon("#F4EFE4"), []);
  useDisposable([arch, frame, step, mat]);
  const a = useRef<THREE.InstancedMesh>(null);
  const f = useRef<THREE.InstancedMesh>(null);
  const s = useRef<THREE.InstancedMesh>(null);

  const layout = useMemo(() => {
    const r = rng(7);
    const q = (y: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, y, 0));
    const arches = Array.from({ length: 10 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const k = 0.9 + r() * 0.35;
      return new THREE.Matrix4().compose(new THREE.Vector3(side * (5.5 + r() * 3.5), 0, -6 - i * 3.6), q(side * (0.25 + r() * 0.3)), new THREE.Vector3(k, k, k));
    });
    const frames = (
      [
        [-4, -14],
        [3.4, -11],
        [-1.6, -22],
        [5.5, -20],
        [-8, -19],
        [7.6, -7],
      ] as const
    ).map(([x, z]) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q((r() - 0.5) * 0.9), new THREE.Vector3(1, 1, 1)));
    const steps: THREE.Matrix4[] = [];
    for (const st of [
      { x: 4.4, z: -3.2, rot: -0.45, n: 6 },
      { x: -4.8, z: -4.5, rot: 0.6, n: 7 },
    ]) {
      const rq = q(st.rot);
      for (let i = 0; i < st.n; i++) {
        const l = new THREE.Vector3(0, 0.11 + i * 0.22, -i * 0.34).applyQuaternion(rq);
        steps.push(new THREE.Matrix4().compose(new THREE.Vector3(st.x + l.x, l.y, st.z + l.z), rq, new THREE.Vector3(1.3, 0.22, 0.36)));
      }
    }
    return { arches, frames, steps };
  }, []);

  useLayoutEffect(() => {
    const fill = (im: THREE.InstancedMesh, list: THREE.Matrix4[]) => {
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    };
    fill(a.current!, layout.arches);
    fill(f.current!, layout.frames);
    fill(s.current!, layout.steps);
  }, [layout]);

  return (
    <>
      <instancedMesh ref={a} args={[arch, mat, layout.arches.length]} />
      <instancedMesh ref={f} args={[frame, mat, layout.frames.length]} />
      <instancedMesh ref={s} args={[step, mat, layout.steps.length]} />
    </>
  );
}

/** progress → camera: a long held hero, then an accelerating push through the doorway */
const camT = (p: number) => (p < 0.3 ? (p / 0.3) * 0.1 : 0.1 + easeInCubic((p - 0.3) / 0.7) * 0.9);

export default function DoorWorld() {
    useAnchorCleanup(["door-hold"]);
  const pivot = useRef<THREE.Group>(null);
  const knob = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const haloTex = useGlowTexture("halo");
  const anim = useRef({ open: 0, ox: 0, oy: 0, offset: new THREE.Vector3(), knob: new THREE.Vector3(), gate: 1, look: new THREE.Vector3() });
  const flight = useFlight(
    [
      [0, 2.9, 20],
      [0, 2.6, 17],
      [0, 1.45, 6.5],
      [0, 1.42, 2.4],
      [0, 1.4, 0.15],
    ],
    [
      [0, 2.35, 0],
      [0, 2.2, 0],
      [0, 1.5, 0],
      [0, 1.4, -0.06],
      [0, 1.4, -0.5],
    ],
  );

  useActiveFrame(IDX, 34, 160, (state, dt) => {
    const a = anim.current;
    const calm = getShared().reducedMotion;
    const p = live.smooth[IDX];
    const hold = live.doorHold;

    const target = Math.max(hold >= 1 ? 1 : 0, smoothstep(0.26, 0.5, p));
    a.open = damp(a.open, target, hold >= 1 ? 3 : 8, dt);
    const strain = hold < 1 ? hold : 0;
    const rattle = calm ? 0 : Math.sin(state.clock.elapsedTime * 41) * 0.008 * strain * (1 - strain) * 4;
    if (pivot.current) pivot.current.rotation.y = -(0.16 * smoothstep(0.05, 0.95, strain) + 1.62 * easeInOutCubic(a.open)) + rattle;
    const breathe = getShared().entered || calm ? 0 : 0.12 + 0.1 * Math.sin(state.clock.elapsedTime * 1.4);
    if (halo.current) halo.current.opacity = 0.35 + 0.45 * Math.max(strain, a.open, breathe * 2);

    const parallax = calm ? 0 : 1 - smoothstep(0.25, 0.45, p);
    a.ox = damp(a.ox, live.pointerX * 0.35 * parallax, 3, dt);
    a.oy = damp(a.oy, live.pointerY * 0.15 * parallax, 3, dt);
    a.offset.set(a.ox, a.oy, 0);
    fly(state.camera, flight, camT(p), a.offset);

    // before entering: a close, slowly swaying portrait of the door; entering pulls back to the hero shot
    a.gate = damp(a.gate, getShared().entered ? 0 : 1, 1.6, dt);
    if (a.gate > 0.001) {
      const g = a.gate * a.gate * (3 - 2 * a.gate);
      const t = state.clock.elapsedTime;
      const sway = calm ? 0 : Math.sin(t * 0.35);
      const cam = state.camera;
      const portrait = state.size.width < state.size.height;
      cam.position.lerp(a.look.set(sway * 0.8, 1.35 + (calm ? 0 : Math.sin(t * 0.5) * 0.05), portrait ? 13.5 : 12), g);
      flight.look.getPointAt(camT(p), flight.tmp);
      flight.tmp.lerp(a.look.set(0, portrait ? 0.45 : 0.7, 0), g);
      cam.lookAt(flight.tmp);
    }

    if (knob.current) {
      knob.current.getWorldPosition(a.knob);
      writeAnchor("door-hold", a.knob, state.camera, state.size);
    }
  });

  return (
    <>

      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[240, 240]} />
        <meshToonMaterial color="#E0D6C1" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 10.5]}>
        <planeGeometry args={[1.5, 20]} />
        <meshToonMaterial color="#D6C9AE" />
      </mesh>

      <mesh ref={fxLayer} position={[0, BASE + H / 2 + 0.1, -0.4]}>
        <planeGeometry args={[4.4, 5.6]} />
        <meshBasicMaterial ref={halo} map={haloTex} color="#FFE2A6" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>

      <Door pivot={pivot} knob={knob} />
      <Hall />
      <BakedShadow shape="rect" position={[0, 0.005, 0.15]} size={[3.4, 1.3]} opacity={0.32} />
    </>
  );
}
