"use client";


import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { site, type Project } from "@/content/site";
import { CHAPTERS, ci } from "@/lib/chapters";
import { damp, getShared, live, smoothstep } from "@/lib/experience";
import { BakedShadow, useAnchorCleanup, useDisposable, useActiveFrame, writeAnchor } from "../helpers";
import { fxLayer, toon } from "../ink";

const IDX = ci("gallery");
const NEXT_BG = CHAPTERS[ci("unfinished")].bg;
const SPACING = 6;
const FIRST_Z = -4;
const END_Z = -28;
const SCREEN_TONES = ["#A9CBDC", "#F2C14E", "#93AA82", "#C7A6E8"];

function archGeometry(w: number, h: number, openW: number, openH: number, depth: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.closePath();
  const hole = new THREE.Path();
  const r = openW / 2;
  hole.moveTo(-r, 0);
  hole.lineTo(-r, openH - r);
  hole.absarc(0, openH - r, r, Math.PI, 0, true);
  hole.lineTo(r, 0);
  hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** colonnades on both sides of the aisle */
function Arcade() {
  const geo = useMemo(() => archGeometry(3.2, 4.6, 2.4, 3.8, 0.5), []);
  const mat = useMemo(() => toon("#F6E7D8"), []);
  useDisposable([geo, mat]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 20;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const z = 4 - Math.floor(i / 2) * 3.4;
      m.compose(new THREE.Vector3(side * 4.4, 0, z), q, new THREE.Vector3(1, 1, 1));
      ref.current!.setMatrixAt(i, m);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, []);
  return <instancedMesh ref={ref} args={[geo, mat, count]} />;
}

/** The project's screenshot as an unlit texture (true photo colours), or null. */
function useScreenshot(src: string | null) {
  const tex = useMemo(() => {
    if (!src) return null;
    const t = new THREE.TextureLoader().load(src);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [src]);
  useDisposable(useMemo(() => (tex ? [tex] : []), [tex]));
  return tex;
}

/**
 * One installation per project: the framed screen stands front and centre on
 * the plinth (it holds the project's screenshot), and the sculpture after the
 * project's motif sits on its own pedestal beside it, never in front of it.
 */
function Installation({ p, k, anchor }: { p: Project; k: number; anchor: (el: THREE.Object3D | null) => void }) {
  const side = k % 2 ? 1 : -1;
  const z = FIRST_Z - k * SPACING;
  const tone = SCREEN_TONES[k % SCREEN_TONES.length];
  const shot = useScreenshot(p.screenshot);
  const m = useMemo(
    () => ({
      plinth: toon("#FBF2E6"),
      body: toon("#F6E7D8"),
      accent: toon(tone),
      gold: toon("#F2C14E"),
      ink: toon("#2A1A16"),
      // The photo must not be toon-banded: unlit, true colours.
      screen: new THREE.MeshBasicMaterial({ map: shot, color: shot ? "#ffffff" : tone, toneMapped: false }),
    }),
    [tone, shot],
  );
  useDisposable(useMemo(() => Object.values(m), [m]));
  const archG = useMemo(() => archGeometry(1.1, 1.5, 0.6, 1.1, 0.3), []);
  useDisposable(useMemo(() => [archG], [archG]));
  return (
    <group position={[side * 2.2, 0, z]} rotation-y={-side * 0.5}>
      <mesh position-y={0.35} material={m.plinth}>
        <boxGeometry args={[1.6, 0.7, 1.1]} />
      </mesh>

      {/* the framed screen, standing on the plinth and facing the aisle */}
      <group position={[0, 0.7 + 0.08 + 1.45 / 2, 0.1]} rotation-x={-0.06}>
        <mesh material={m.gold}>
          <boxGeometry args={[2.2, 1.45, 0.1]} />
        </mesh>
        <mesh position-z={0.06} material={m.screen}>
          <boxGeometry args={[1.96, 1.21, 0.02]} />
        </mesh>
        {/* easel strut behind */}
        <mesh position={[0, -0.35, -0.22]} rotation-x={0.35} material={m.ink}>
          <boxGeometry args={[0.08, 1.0, 0.06]} />
        </mesh>
      </group>
      {/* little foot rail the frame rests on */}
      <mesh position={[0, 0.74, 0.12]} material={m.ink}>
        <boxGeometry args={[2.0, 0.08, 0.14]} />
      </mesh>

      {/* the sculpture, on its own pedestal on the outer side */}
      <mesh position={[side * 1.55, 0.45, -0.35]} material={m.plinth}>
        <boxGeometry args={[0.8, 0.9, 0.8]} />
      </mesh>
      <group position={[side * 1.55, 0.9, -0.35]} scale={0.55}>
        {p.motif === "arch" && <mesh geometry={archG} material={m.accent} />}
        {p.motif === "window" && (
          <group>
            <mesh position-y={0.7} material={m.accent}>
              <boxGeometry args={[0.9, 1.4, 0.12]} />
            </mesh>
            <mesh position={[0, 0.7, 0.07]} material={m.body}>
              <boxGeometry args={[0.7, 1.2, 0.04]} />
            </mesh>
            <mesh position={[0, 0.7, 0.1]} material={m.accent}>
              <boxGeometry args={[0.06, 1.2, 0.03]} />
            </mesh>
          </group>
        )}
        {p.motif === "stair" &&
          [0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, 0.12 + i * 0.24, -i * 0.18 + 0.27]} material={i % 2 ? m.accent : m.body}>
              <boxGeometry args={[1.0, 0.24, 0.36]} />
            </mesh>
          ))}
        {p.motif === "tower" && (
          <group>
            <mesh position-y={0.6} material={m.body}>
              <boxGeometry args={[0.5, 1.2, 0.5]} />
            </mesh>
            <mesh position-y={1.45} rotation-y={Math.PI / 4} material={m.accent}>
              <coneGeometry args={[0.45, 0.5, 4]} />
            </mesh>
          </group>
        )}
      </group>
      <object3D ref={anchor} position={[0, 2.85, 0]} />
    </group>
  );
}

/** keyframes: camera z when each installation is centred in view */
const KEYS = [
  [0, 7],
  [0.24, 2.2],
  ...site.projects.map((_, k) => [0.31 + k * 0.17, FIRST_Z - k * SPACING + 5.5]),
  [1, END_Z - 0.6],
] as [number, number][];

function camZ(p: number) {
  for (let i = 1; i < KEYS.length; i++) {
    const [p1, z1] = KEYS[i];
    const [p0, z0] = KEYS[i - 1];
    if (p <= p1) {
      const t = (p - p0) / (p1 - p0);
      return THREE.MathUtils.lerp(z0, z1, t * t * (3 - 2 * t)); // linger at each work
    }
  }
  return KEYS[KEYS.length - 1][1];
}

export default function GalleryWorld() {
    const names = useMemo(() => site.projects.map((_, k) => `project-${k}`), []);
  useAnchorCleanup(names);
  const anchors = useRef<(THREE.Object3D | null)[]>([]);
  const s = useRef({ look: new THREE.Vector3(), v: new THREE.Vector3(), lx: 0, ox: 0, oy: 0 });
  const m = useMemo(() => ({ floor: toon("#E8B3A2"), runner: toon("#F3D3C2"), arch: toon("#F6E7D8") }), []);
  const endArch = useMemo(() => archGeometry(5, 6.2, 3, 5, 0.8), []);
  useDisposable([...Object.values(m), endArch]);

  useActiveFrame(IDX, 50, 90, (state, dt) => {
    const p = live.smooth[IDX];
    const k = s.current;
    const calm = getShared().reducedMotion;
    const z = camZ(p);

    // lean towards whichever installation is nearest
    let lean = 0;
    site.projects.forEach((_, i) => {
      const iz = FIRST_Z - i * SPACING;
      const w = 1 - smoothstep(1.5, 5, Math.abs(z - 5.5 - iz));
      lean += (i % 2 ? 1 : -1) * w;
    });
    const toEnd = smoothstep(0.86, 1, p);
    k.lx = damp(k.lx, lean * (1 - toEnd), 3, dt);
    k.ox = damp(k.ox, calm ? 0 : live.pointerX * 0.25, 2.5, dt);
    k.oy = damp(k.oy, calm ? 0 : live.pointerY * 0.12, 2.5, dt);
    const cam = state.camera;
    cam.position.set(k.lx * 0.4 + k.ox, 2.6 + k.oy, z);
    k.look.set(k.lx * 1.8, 1.5, z - 6);
    cam.lookAt(k.look);

    anchors.current.forEach((a, i) => {
      if (!a) return;
      a.getWorldPosition(k.v);
      writeAnchor(names[i], k.v, cam, state.size);
    });
  });

  return (
    <>

      <mesh rotation-x={-Math.PI / 2} position-z={-12} material={m.floor}>
        <planeGeometry args={[60, 80]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, -12]} material={m.runner}>
        <planeGeometry args={[1.6, 44]} />
      </mesh>

      <Arcade />
      {site.projects.map((p, k) => (
        <Installation key={p.slug} p={p} k={k} anchor={(el) => void (anchors.current[k] = el)} />
      ))}
      {site.projects.map((_, k) => (
        <BakedShadow key={k} position={[(k % 2 ? 1 : -1) * 2.2, 0.006, FIRST_Z - k * SPACING]} size={[2.4, 1.8]} opacity={0.22} />
      ))}

      {/* the way out: a great arch filled with the next world's light */}
      <group position={[0, 0, END_Z]}>
        <mesh geometry={endArch} material={m.arch} />
        <mesh ref={fxLayer} position={[0, 2.5, -0.3]}>
          <planeGeometry args={[3.2, 5.2]} />
          <meshBasicMaterial color={NEXT_BG} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}
