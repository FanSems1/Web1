"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { read, site } from "@/content/site";
import { CHAPTERS, ci } from "@/lib/chapters";
import { damp, getShared, live, smoothstep } from "@/lib/experience";
import { BakedShadow, rng, useActiveFrame, useAnchorCleanup, useDisposable, useGlowTexture, writeAnchor } from "../helpers";
import { fxLayer, toon } from "../ink";

const IDX = ci("observatory");
const NEXT_BG = CHAPTERS[ci("gallery")].bg;
const ENTRIES = read(site.experience);
const N = ENTRIES.length;
/** each journey entry is a constellation, spread across the sky */
const AZ = Array.from({ length: N }, (_, i) => (N === 1 ? 0 : -0.95 + (1.9 * i) / (N - 1)));
// low in the sky, so the constellations sit above the telescope, not at the top edge
const ELEV = 0.22;
const PIVOT = new THREE.Vector3(0, 1.55, 0);
const SKY_R = 36;

const dirOf = (az: number, el: number, out = new THREE.Vector3()) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

/** where the telescope points: scroll sweeps it across the sky, dragging adds to it */
export function aimAt(p: number) {
  return THREE.MathUtils.lerp(AZ[0] - 0.25, AZ[N - 1] + 0.25, smoothstep(0.2, 0.84, p)) + live.scopeYaw;
}

function Hill() {
  const m = useMemo(() => ({ hill: toon("#3D4C8C"), grass: toon("#5163A6"), rock: toon("#6475B0") }), []);
  useDisposable(Object.values(m));
  const tufts = useMemo(() => {
    const r = rng(14);
    return Array.from({ length: 26 }, () => {
      const a = r() * Math.PI * 2;
      const d = 2 + r() * 9;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.15 + r() * 0.25 };
    });
  }, []);
  return (
    <>
      <mesh position-y={-29.6} material={m.hill}>
        <sphereGeometry args={[30, 64, 24, 0, Math.PI * 2, 0, 0.6]} />
      </mesh>
      {tufts.map((t, i) => (
        <mesh key={i} position={[t.x, 0.35 - (t.x * t.x + t.z * t.z) / 60 + t.s * 0.3, t.z]} scale={[t.s, t.s * 0.7, t.s]} material={i % 3 ? m.grass : m.rock}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </>
  );
}

function ObservatoryHouse() {
  const m = useMemo(() => ({ wall: toon("#D9D6F0"), dome: toon("#C3BFE6"), slit: toon("#141A3A"), door: toon("#F2C14E"), window: toon("#FFE39A") }), []);
  useDisposable(Object.values(m));
  return (
    <group position={[-9, -0.6, -6]} rotation-y={0.9} scale={1.3}>
      <mesh position-y={1.1} material={m.wall}>
        <cylinderGeometry args={[1.5, 1.6, 2.2, 28]} />
      </mesh>
      <mesh position-y={2.2} material={m.dome}>
        <sphereGeometry args={[1.55, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 3.05, 0.95]} rotation-x={-0.55} material={m.slit}>
        <boxGeometry args={[0.45, 1.3, 0.2]} />
      </mesh>
      <mesh position={[0, 0.65, 1.56]} material={m.door}>
        <boxGeometry args={[0.6, 1.2, 0.08]} />
      </mesh>
      <mesh position={[0.95, 1.45, 1.2]} rotation-y={0.65} material={m.window}>
        <circleGeometry args={[0.2, 16]} />
      </mesh>
    </group>
  );
}

function Telescope({ tube }: { tube: React.RefObject<THREE.Group | null> }) {
  const m = useMemo(() => ({ brass: toon("#E7B24F"), dark: toon("#2A2F4F"), wood: toon("#8C5A3C") }), []);
  useDisposable(Object.values(m));
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.45, 0.72, Math.cos(a) * 0.45]} rotation={[Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4]} material={m.wood}>
            <cylinderGeometry args={[0.04, 0.05, 1.55, 8]} />
          </mesh>
        );
      })}
      <mesh position-y={1.45} material={m.dark}>
        <boxGeometry args={[0.3, 0.22, 0.3]} />
      </mesh>
      <group ref={tube} position={PIVOT}>
        <group rotation-x={Math.PI / 2}>
          {/* tube runs along local -z: eyepiece behind, lens in front */}
          <mesh position-y={-0.2} material={m.brass}>
            <cylinderGeometry args={[0.2, 0.15, 2.3, 20]} />
          </mesh>
          {[-1.1, -0.2, 0.7].map((y) => (
            <mesh key={y} position-y={y} material={m.dark}>
              <cylinderGeometry args={[0.215, 0.215, 0.08, 20]} />
            </mesh>
          ))}
          <mesh position-y={1.1} material={m.dark}>
            <cylinderGeometry args={[0.07, 0.09, 0.3, 12]} />
          </mesh>
          {/* the lens glows with the next world's colour: the way out */}
          <mesh ref={fxLayer} position-y={-1.36} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.18, 24]} />
            <meshBasicMaterial color={NEXT_BG} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** a sky of stars and one constellation per journey entry */
function Sky({ active }: { active: React.RefObject<number[]> }) {
  const glow = useGlowTexture("radial");
  const stars = useMemo(() => {
    const r = rng(3);
    const n = 1100;
    const pos = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      dirOf((r() - 0.5) * Math.PI * 2.2, 0.05 + r() * 1.35, v).multiplyScalar(SKY_R + 8);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const groups = useMemo(() => {
    const r = rng(8);
    return AZ.map((az, k) => {
      const centre = dirOf(az, ELEV + (k % 2 ? 0.07 : 0)).multiplyScalar(SKY_R);
      const right = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const up = new THREE.Vector3(0, 1, 0);
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + r() * 0.6;
        const d = 1.6 + r() * 2.4;
        return centre.clone().addScaledVector(right, Math.cos(a) * d * 1.3).addScaledVector(up, Math.sin(a) * d);
      });
      // a path through the stars, the way people draw constellations
      const order = [0, 1, 2, 3, 4, 5, 2];
      const line = new THREE.BufferGeometry().setFromPoints(order.slice(0, -1).flatMap((a, i) => [pts[a], pts[order[i + 1]]]));
      return { centre, pts, line };
    });
  }, []);
  useDisposable([stars, ...groups.map((g) => g.line)]);
  const lines = useRef<(THREE.LineSegments | null)[]>([]);
  const sprites = useRef<(THREE.SpriteMaterial | null)[]>([]);
  useFrame((s) => {
    if (getShared().chapter !== IDX) return;
    const t = s.clock.elapsedTime;
    groups.forEach((g, k) => {
      const a = active.current[k] ?? 0;
      const l = lines.current[k];
      if (l) l.geometry.setDrawRange(0, Math.floor((g.line.attributes.position.count * a) / 2) * 2);
      g.pts.forEach((_, i) => {
        const m = sprites.current[k * 6 + i];
        if (m) m.opacity = 0.55 + a * 0.45 + (getShared().reducedMotion ? 0 : Math.sin(t * 2 + i + k) * 0.08);
      });
    });
  });
  return (
    <>
      <points ref={fxLayer} geometry={stars}>
        <pointsMaterial color="#E9E4FF" size={0.18} sizeAttenuation transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </points>
      {groups.map((g, k) => (
        <group key={k}>
          {g.pts.map((p, i) => (
            <sprite key={i} ref={fxLayer} position={p} scale={1.4}>
              <spriteMaterial ref={(el) => void (sprites.current[k * 6 + i] = el)} map={glow} color="#FFF4C8" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </sprite>
          ))}
          <lineSegments ref={(el) => { lines.current[k] = el; fxLayer(el); }} geometry={g.line}>
            <lineBasicMaterial color="#F2C14E" />
          </lineSegments>
        </group>
      ))}
    </>
  );
}

export default function ObservatoryWorld() {
  const names = useMemo(() => ENTRIES.map((_, k) => `exp-${k}`), []);
  useAnchorCleanup(names);
  const tube = useRef<THREE.Group>(null);
  const active = useRef<number[]>(AZ.map(() => 0));
  const centres = useMemo(() => AZ.map((az, k) => dirOf(az, ELEV + (k % 2 ? 0.07 : 0)).multiplyScalar(SKY_R)), []);
  const s = useRef({ aim: AZ[0], v: new THREE.Vector3(), look: new THREE.Vector3(), axis: new THREE.Vector3(), ox: 0, oy: 0 });

  useActiveFrame(IDX, 42, 120, (state, dt) => {
    const p = live.smooth[IDX];
    const calm = getShared().reducedMotion;
    const k = s.current;
    k.aim = damp(k.aim, aimAt(p), calm ? 30 : 2.6, dt);
    if (tube.current) tube.current.rotation.set(ELEV, -k.aim, 0, "YXZ");
    dirOf(k.aim, ELEV, k.axis);

    // a constellation lights up while the telescope points at it
    AZ.forEach((az, i) => {
      const target = 1 - smoothstep(0.1, 0.26, Math.abs(k.aim - az));
      active.current[i] = damp(active.current[i], target, calm ? 30 : 3, dt);
    });

    // arrive looking up at the stars (0–.18) · stand behind the telescope · fly down its tube into the lens
    k.ox = damp(k.ox, calm ? 0 : live.pointerX * 0.3, 2.5, dt);
    k.oy = damp(k.oy, calm ? 0 : live.pointerY * 0.15, 2.5, dt);
    const arrive = smoothstep(0, 0.18, p);
    const exit = smoothstep(0.86, 1, p);
    const behind = new THREE.Vector3(-k.axis.x, 0, -k.axis.z).normalize();
    // stand back and a little above, so hill, telescope and observatory frame the lower third
    k.v.copy(PIVOT).addScaledVector(behind, THREE.MathUtils.lerp(4, 11.5, arrive)).add(new THREE.Vector3(0, THREE.MathUtils.lerp(0.8, 2.3, arrive), 0));
    k.look.copy(PIVOT).addScaledVector(behind, -18).add(new THREE.Vector3(0, THREE.MathUtils.lerp(16, 3.6, arrive), 0));
    if (exit > 0) {
      const lens = PIVOT.clone().addScaledVector(k.axis, 1.55);
      const eye = PIVOT.clone().addScaledVector(k.axis, -1.6).add(new THREE.Vector3(0, 0.05, 0));
      const t = exit * exit * (3 - 2 * exit);
      const toEye = smoothstep(0, 0.45, t);
      const intoLens = smoothstep(0.45, 1, t);
      k.v.lerp(eye, toEye).lerp(lens, intoLens);
      k.look.lerp(PIVOT.clone().addScaledVector(k.axis, 8), toEye);
    }
    state.camera.position.set(k.v.x + k.ox * (1 - exit), k.v.y + k.oy * (1 - exit), k.v.z);
    state.camera.lookAt(k.look);

    centres.forEach((c, i) => {
      writeAnchor(names[i], c, state.camera, state.size);
      const a = live.anchors.get(names[i]);
      if (a) a.visible = a.visible && active.current[i] > 0.55;
    });
  });

  return (
    <>
      <Hill />
      <ObservatoryHouse />
      <Telescope tube={tube} />
      <Sky active={active} />
      <BakedShadow position={[0, 0.02, 0]} size={[1.8, 1.8]} opacity={0.3} color="#0b1030" />
    </>
  );
}
