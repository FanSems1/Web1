"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CHAPTERS, ci } from "@/lib/chapters";
import { damp, getShared, live, smoothstep } from "@/lib/experience";
import { rig } from "../Stage";
import { BakedShadow, rng, useActiveFrame, useAnchorCleanup, useDisposable, useGlowTexture, writeAnchor } from "../helpers";
import { fxLayer, toon } from "../ink";

const IDX = ci("reef");
const NEXT_BG = CHAPTERS[ci("observatory")].bg;

/** the four skill groups ride on jellyfish */
const JELLIES = [
  { pos: new THREE.Vector3(-1.7, 2.4, 0.4), color: "#F7B2D9", phase: 0 },
  { pos: new THREE.Vector3(-0.5, 3.2, -0.4), color: "#C7A6E8", phase: 1.7 },
  { pos: new THREE.Vector3(0.7, 2.2, 0.5), color: "#FFE08A", phase: 3.1 },
  { pos: new THREE.Vector3(1.8, 3.1, -0.5), color: "#9DE0E6", phase: 4.4 },
];
const LANTERN = new THREE.Vector3(2.2, 0, 2.9);
const LAMP = LANTERN.clone().add(new THREE.Vector3(0, 2.2, 0));
const DAY = new THREE.Color(CHAPTERS[IDX].bg);
const NIGHT = new THREE.Color("#081A2B");
const NEON = ["#FF6FCF", "#B38CFF", "#FFE45C", "#5CF2FF"].map((c) => new THREE.Color(c));
const PORTHOLE = new THREE.Vector3(-0.6, 2.6, -9);
/** camera keyframes: surface → reef → glide end → porthole */
const CAM = [new THREE.Vector3(1, 8.6, 11.5), new THREE.Vector3(0.4, 3.0, 10.2), new THREE.Vector3(-0.2, 2.75, 7.6), new THREE.Vector3(-0.6, 2.6, -8.65)];
const LOOK = [new THREE.Vector3(0.6, 2.2, 3), new THREE.Vector3(0.2, 2.6, 0), new THREE.Vector3(-0.1, 2.7, -1), new THREE.Vector3(-0.6, 2.6, -10.5)];

function useMats() {
  const m = useMemo(
    () => ({
      sand: toon("#EBD8A8"),
      dune: toon("#E2CB94"),
      rock: toon("#6F9198"),
      rockLight: toon("#8DAAAE"),
      coralRed: toon("#F27C7C"),
      coralOrange: toon("#F4A259"),
      brain: toon("#E9A2C8"),
      fan: toon("#9B72CF", { side: THREE.DoubleSide }),
      kelp: toon("#4E8F5A"),
      kelpLight: toon("#6DAA62"),
      wood: toon("#8C5A3C"),
      woodDark: toon("#6B432C"),
      brass: toon("#E7B24F"),
      iron: toon("#2C3C40"),
      bubble: toon("#E8F7FA"),
      fish: toon("#ffffff"),
    }),
    [],
  );
  useDisposable(Object.values(m));
  return m;
}
type Mats = ReturnType<typeof useMats>;

/** branching coral: a little recursive tree of tapered tubes */
function Coral({ position, scale, mat, seed }: { position: [number, number, number]; scale: number; mat: THREE.Material; seed: number }) {
  const geos = useMemo(() => {
    const rand = rng(seed);
    const out: THREE.BufferGeometry[] = [];
    const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
      const to = from.clone().addScaledVector(dir, len);
      const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3((rand() - 0.5) * 0.1, 0, (rand() - 0.5) * 0.1));
      out.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 5, r, 6));
      if (depth > 0) {
        const n = 2 + Math.floor(rand() * 2);
        for (let i = 0; i < n; i++) {
          const d = dir.clone().add(new THREE.Vector3((rand() - 0.5) * 1.2, 0.2 + rand() * 0.4, (rand() - 0.5) * 1.2)).normalize();
          grow(to, d, len * (0.65 + rand() * 0.2), r * 0.7, depth - 1);
        }
      } else {
        const tip = new THREE.SphereGeometry(r * 1.4, 8, 6);
        tip.translate(to.x, to.y, to.z);
        out.push(tip);
      }
    };
    grow(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.5, 0.07, 3);
    return out;
  }, [seed]);
  useDisposable(geos);
  return (
    <group position={position} scale={scale}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} />
      ))}
    </group>
  );
}

function Seafloor({ mats }: { mats: Mats }) {
  const rocks = useRef<THREE.InstancedMesh>(null);
  const brains = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => ({ rock: new THREE.IcosahedronGeometry(1, 0), brain: new THREE.IcosahedronGeometry(1, 2) }), []);
  useDisposable(Object.values(geo));
  const layout = useMemo(() => {
    const rand = rng(23);
    const rockList = Array.from({ length: 22 }, () => {
      const x = (rand() - 0.5) * 16;
      const z = -8 + rand() * 14;
      const s = 0.3 + rand() * 0.9;
      return new THREE.Matrix4().compose(new THREE.Vector3(x, s * 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand() * 3, rand())), new THREE.Vector3(s * 1.3, s * 0.8, s));
    });
    const brainList = Array.from({ length: 9 }, () => {
      const s = 0.25 + rand() * 0.3;
      return new THREE.Matrix4().compose(new THREE.Vector3((rand() - 0.5) * 9, s * 0.4, -3 + rand() * 7), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.7, s));
    });
    return { rockList, brainList };
  }, []);
  useLayoutEffect(() => {
    layout.rockList.forEach((m, i) => rocks.current!.setMatrixAt(i, m));
    layout.brainList.forEach((m, i) => brains.current!.setMatrixAt(i, m));
    for (const r of [rocks, brains]) {
      r.current!.instanceMatrix.needsUpdate = true;
      r.current!.computeBoundingSphere();
    }
  }, [layout]);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-z={-4} material={mats.sand}>
        <planeGeometry args={[80, 80]} />
      </mesh>
      {(
        [
          [-3.5, -1, 2.2],
          [4, 1.5, 1.8],
          [0.5, -5, 3],
        ] as const
      ).map(([x, z, s], i) => (
        <mesh key={i} position={[x, -s * 0.75, z]} scale={[s * 1.6, s, s]} material={mats.dune}>
          <sphereGeometry args={[1, 20, 12]} />
        </mesh>
      ))}
      <instancedMesh ref={rocks} args={[geo.rock, mats.rock, layout.rockList.length]} />
      <instancedMesh ref={brains} args={[geo.brain, mats.brain, layout.brainList.length]} />
      <Coral position={[-3.2, 0, 1.6]} scale={1.3} mat={mats.coralRed} seed={1} />
      <Coral position={[-1.4, 0, -1.5]} scale={1.0} mat={mats.coralOrange} seed={2} />
      <Coral position={[1.8, 0, 1.2]} scale={1.1} mat={mats.coralRed} seed={3} />
      <Coral position={[3.6, 0, -1.8]} scale={1.4} mat={mats.coralOrange} seed={4} />
      <Coral position={[0.2, 0, 3.4]} scale={0.8} mat={mats.coralOrange} seed={5} />
      {(
        [
          [-2.4, -2.6, 0.4],
          [2.6, 0.2, -0.5],
          [-0.2, -3.6, 0.1],
        ] as const
      ).map(([x, z, r], i) => (
        <mesh key={i} position={[x, 0.75, z]} rotation-y={r} material={mats.fan}>
          <circleGeometry args={[0.75, 14, 0, Math.PI]} />
        </mesh>
      ))}
    </>
  );
}

/** kelp: stacked segments that sway like a slow pendulum chain */
function Kelp({ mats }: { mats: Mats }) {
  const stalks = useRef<(THREE.Group | null)[]>([]);
  const list = useMemo(() => {
    const rand = rng(77);
    return Array.from({ length: 14 }, () => ({ x: (rand() - 0.5) * 14, z: -5.5 + rand() * 8, n: 6 + Math.floor(rand() * 5), ph: rand() * 6, light: rand() > 0.5 }));
  }, []);
  const seg = useMemo(() => new THREE.BoxGeometry(0.16, 0.5, 0.04).translate(0, 0.25, 0), []);
  useDisposable([seg]);
  useFrame((s) => {
    if (getShared().chapter !== IDX || getShared().reducedMotion) return;
    const t = s.clock.elapsedTime;
    stalks.current.forEach((g, i) => {
      if (!g) return;
      let node: THREE.Object3D | undefined = g.children[0];
      let k = 0;
      while (node) {
        node.rotation.z = Math.sin(t * 0.8 + list[i].ph + k * 0.5) * 0.12;
        node = node.children.find((c) => c.type === "Group");
        k++;
      }
    });
  });
  const chain = (n: number, mat: THREE.Material): React.ReactNode =>
    n === 0 ? null : (
      <group position-y={0.5}>
        <mesh geometry={seg} material={mat} />
        {chain(n - 1, mat)}
      </group>
    );
  return (
    <>
      {list.map((k, i) => (
        <group key={i} ref={(el) => void (stalks.current[i] = el)} position={[k.x, -0.5, k.z]}>
          {chain(k.n, k.light ? mats.kelpLight : mats.kelp)}
        </group>
      ))}
    </>
  );
}

function Jellyfish({ power }: { power: React.RefObject<number> }) {
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const mats = useMemo(() => JELLIES.map((j) => toon(j.color, { transparent: true, opacity: 0.92 })), []);
  const geo = useMemo(() => {
    const dome = new THREE.SphereGeometry(0.42, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const rim = new THREE.TorusGeometry(0.41, 0.035, 6, 24).rotateX(Math.PI / 2);
    const tentacles = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      const r = 0.24;
      const pts = Array.from({ length: 5 }, (_, k) => new THREE.Vector3(Math.cos(a) * r + Math.sin(k * 1.3 + i) * 0.06, -k * 0.22, Math.sin(a) * r + Math.cos(k * 1.1 + i) * 0.06));
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.016, 4);
    });
    return { dome, rim, tentacles };
  }, []);
  useDisposable([...mats, geo.dome, geo.rim, ...geo.tentacles]);
  const white = useMemo(() => new THREE.Color("#ffffff"), []);
  const base = useMemo(() => JELLIES.map((j) => new THREE.Color(j.color)), []);
  const halos = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const glow = useGlowTexture("radial");
  useFrame((s) => {
    if (getShared().chapter !== IDX) return;
    const calm = getShared().reducedMotion;
    const t = s.clock.elapsedTime;
    const p = power.current;
    bodies.current.forEach((b, i) => {
      if (!b) return;
      const j = JELLIES[i];
      const pulse = calm ? 0 : Math.sin(t * 1.6 + j.phase);
      b.position.set(j.pos.x, j.pos.y + (calm ? 0 : Math.sin(t * 0.6 + j.phase) * 0.15) + p * 0.35, j.pos.z);
      b.scale.set(1 + pulse * 0.06, 1 - pulse * 0.08, 1 + pulse * 0.06);
      mats[i].color.copy(base[i]).lerp(white, p * 0.25);
      // bioluminescence: they glow from within when the reef goes dark
      const n = live.night;
      mats[i].emissive.copy(NEON[i]).multiplyScalar(n * (0.75 + 0.25 * (calm ? 1 : Math.sin(t * 2.3 + j.phase))));
      const h = halos.current[i];
      if (h) h.opacity = n * (0.45 + 0.15 * Math.sin(t * 1.7 + j.phase));
    });
  });
  return (
    <>
      {JELLIES.map((j, i) => (
        <group key={i} ref={(el) => void (bodies.current[i] = el)} position={j.pos}>
          <mesh geometry={geo.dome} material={mats[i]} />
          <mesh geometry={geo.rim} material={mats[i]} />
          {geo.tentacles.map((g, k) => (
            <mesh key={k} geometry={g} material={mats[i]} />
          ))}
          <sprite ref={fxLayer} scale={2.6} position-y={-0.1}>
            <spriteMaterial ref={(el) => void (halos.current[i] = el)} map={glow} color={NEON[i]} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </>
  );
}

/** a school of little fish circling the reef; they gather at the lantern when it's lit */
function School({ mats, power }: { mats: Mats; power: React.RefObject<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 36;
  const fish = useMemo(() => {
    const rand = rng(31);
    return Array.from({ length: N }, () => ({ a: rand() * Math.PI * 2, r: 2.4 + rand() * 1.6, y: 1.6 + rand() * 2.2, speed: 0.25 + rand() * 0.2, color: rand() > 0.5 ? "#F4A259" : "#FFE08A" }));
  }, []);
  const geo = useMemo(() => new THREE.ConeGeometry(0.06, 0.26, 5).rotateZ(-Math.PI / 2), []);
  useDisposable([geo]);
  const tmp = useRef({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0), center: new THREE.Vector3(0.6, 0, 0.4) });
  useLayoutEffect(() => {
    const c = new THREE.Color();
    fish.forEach((f, i) => ref.current!.setColorAt(i, c.set(f.color)));
    ref.current!.instanceColor!.needsUpdate = true;
  }, [fish]);
  useFrame((s, d) => {
    if (getShared().chapter !== IDX) return;
    const k = tmp.current;
    const p = power.current;
    const dt = getShared().reducedMotion ? 0 : Math.min(d, 0.05);
    k.center.set(THREE.MathUtils.lerp(0.6, LANTERN.x, p * 0.7), 0, THREE.MathUtils.lerp(0.4, LANTERN.z, p * 0.7));
    fish.forEach((f, i) => {
      f.a += dt * f.speed * (1 + p * 1.5);
      const r = f.r * (1 - p * 0.55);
      k.p.set(k.center.x + Math.cos(f.a) * r, f.y - p * 0.6, k.center.z + Math.sin(f.a) * r);
      k.q.setFromAxisAngle(k.up, -f.a - Math.PI / 2);
      k.m.compose(k.p, k.q, k.s);
      ref.current!.setMatrixAt(i, k.m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mats.fish, N]} frustumCulled={false} />;
}

function Bubbles({ mats, power }: { mats: Mats; power: React.RefObject<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 40;
  const list = useMemo(() => {
    const rand = rng(5);
    return Array.from({ length: N }, () => ({ x: (rand() - 0.5) * 10, z: -6 + rand() * 10, y: rand() * 9, s: 0.03 + rand() * 0.07, sp: 0.4 + rand() * 0.6, ph: rand() * 6 }));
  }, []);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  useDisposable([geo]);
  const tmp = useRef({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() });
  useFrame((st, d) => {
    if (getShared().chapter !== IDX) return;
    const k = tmp.current;
    const dt = getShared().reducedMotion ? 0 : Math.min(d, 0.05);
    const boost = 1 + power.current * 2;
    list.forEach((b, i) => {
      b.y += dt * b.sp * boost;
      if (b.y > 9) b.y = 0;
      k.p.set(b.x + Math.sin(st.clock.elapsedTime + b.ph) * 0.1, b.y, b.z);
      k.s.setScalar(b.s);
      k.m.compose(k.p, k.q, k.s);
      ref.current!.setMatrixAt(i, k.m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mats.bubble, N]} frustumCulled={false} />;
}

/** light from the surface, falling in soft slanted shafts (no ink lines) */
function Surface() {
  const shafts = useRef<THREE.Group>(null);
  const shaftMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const tex = useGlowTexture("halo");
  useFrame((s) => {
    if (getShared().chapter !== IDX || !shafts.current) return;
    // daylight shafts fade out when the reef goes dark
    shaftMats.current.forEach((m) => m && (m.opacity = 0.22 * (1 - live.night)));
    shafts.current.visible = live.night < 0.98;
    if (!getShared().reducedMotion) shafts.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.2) * 0.04;
  });
  return (
    <>
      <mesh rotation-x={Math.PI / 2} position={[0, 9.5, -3]}>
        <planeGeometry args={[80, 80]} />
        <meshToonMaterial color="#A6DCE8" />
      </mesh>
      <group ref={(el) => { shafts.current = el; fxLayer(el); }}>
        {[-4, -1.5, 1, 3.5, 6].map((x, i) => (
          <mesh key={i} position={[x, 5, -2 + (i % 2) * 2]} rotation={[0, 0, 0.25]}>
            <planeGeometry args={[1.4, 11]} />
            <meshBasicMaterial ref={(el) => void (shaftMats.current[i] = el)} map={tex} color="#E6FAFF" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function Lantern({ mats, power, anchor }: { mats: Mats; power: React.RefObject<number>; anchor: React.RefObject<THREE.Object3D | null> }) {
  const bulb = useRef<THREE.MeshToonMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useGlowTexture("radial");
  const off = useMemo(() => new THREE.Color("#FFF2C9"), []);
  const on = useMemo(() => new THREE.Color("#FFD36B"), []);
  useFrame(() => {
    if (getShared().chapter !== IDX) return;
    const p = power.current;
    bulb.current?.color.copy(off).lerp(on, p);
    if (halo.current) halo.current.opacity = (0.1 + p * 0.5) * (1 - live.night * 0.55);
    bulb.current?.emissive.copy(on).multiplyScalar(live.night);
  });
  return (
    <group position={LANTERN}>
      <mesh position-y={0.3} material={mats.rockLight}>
        <icosahedronGeometry args={[0.6, 0]} />
      </mesh>
      <mesh position-y={1.2} material={mats.iron}>
        <cylinderGeometry args={[0.04, 0.05, 1.2, 8]} />
      </mesh>
      <group position-y={1.95}>
        <mesh material={mats.brass}>
          <cylinderGeometry args={[0.22, 0.22, 0.08, 14]} />
        </mesh>
        <mesh position-y={0.24}>
          <sphereGeometry args={[0.16, 16, 12]} />
          <meshToonMaterial ref={bulb} color="#FFF2C9" />
        </mesh>
        <mesh position-y={0.5} material={mats.brass}>
          <coneGeometry args={[0.24, 0.16, 14]} />
        </mesh>
        <mesh ref={fxLayer} position-y={0.24}>
          <planeGeometry args={[4.2, 4.2]} />
          <meshBasicMaterial ref={halo} map={tex} color="#FFE08A" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      </group>
      <object3D ref={anchor} position={[0, 1.4, 0.6]} />
    </group>
  );
}

/** a sunken hull; its porthole glows with the gallery's colour — the way out */
function Wreck({ mats }: { mats: Mats }) {
  return (
    <group position={[PORTHOLE.x, 0, PORTHOLE.z - 0.3]} rotation={[0, 0.12, -0.06]}>
      <mesh position-y={2.4} material={mats.wood}>
        <boxGeometry args={[7, 4.8, 0.5]} />
      </mesh>
      {[0.9, 1.9, 3.0, 4.0].map((y) => (
        <mesh key={y} position={[0, y, 0.27]} material={mats.woodDark}>
          <boxGeometry args={[7, 0.06, 0.04]} />
        </mesh>
      ))}
      <group position={[0, PORTHOLE.y, 0.3]}>
        <mesh material={mats.brass}>
          <torusGeometry args={[0.55, 0.11, 10, 32]} />
        </mesh>
        <mesh ref={fxLayer} position-z={-0.02}>
          <circleGeometry args={[0.5, 32]} />
          <meshBasicMaterial color={NEXT_BG} toneMapped={false} />
        </mesh>
      </group>
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} position={[x, PORTHOLE.y, 0.32]} material={mats.brass}>
          <torusGeometry args={[0.32, 0.07, 8, 24]} />
        </mesh>
      ))}
    </group>
  );
}

/** glowing plankton, only visible in the dark */
function Plankton() {
  const mat = useRef<THREE.PointsMaterial>(null);
  const group = useRef<THREE.Object3D | null>(null);
  const geo = useMemo(() => {
    const rand = rng(61);
    const n = 320;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * 16;
      pos[i * 3 + 1] = 0.3 + rand() * 7;
      pos[i * 3 + 2] = -8 + rand() * 18;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useDisposable([geo]);
  useFrame((s, d) => {
    if (getShared().chapter !== IDX) return;
    if (mat.current) mat.current.opacity = live.night * 0.9;
    if (group.current) {
      group.current.visible = live.night > 0.01;
      if (!getShared().reducedMotion) group.current.rotation.y += Math.min(d, 0.05) * 0.03;
    }
  });
  return (
    <points
      ref={(el) => {
        group.current = el;
        fxLayer(el);
      }}
      geometry={geo}
      visible={false}
    >
      <pointsMaterial ref={mat} color="#9FF0FF" size={0.07} sizeAttenuation transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

/** what lives in the dark: a great whale far off, a manta overhead — they appear when the reef goes dark */
function NightCreatures() {
  const whale = useRef<THREE.Group>(null);
  const manta = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const swim = useRef(0);
  const m = useMemo(
    () => ({
      whale: toon("#2D5E80"),
      belly: toon("#2C5A78"),
      manta: toon("#21465F", { side: THREE.DoubleSide }),
      spot: toon("#9FF0FF", { emissive: new THREE.Color("#9FF0FF"), emissiveIntensity: 1 }),
    }),
    [],
  );
  const geo = useMemo(() => {
    const prof = [
      [0.02, 0],
      [0.25, 0.5],
      [0.6, 1.5],
      [1.0, 3],
      [1.15, 4.5],
      [1.05, 6],
      [0.75, 7.2],
      [0.3, 7.9],
      [0.02, 8.1],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.LatheGeometry(prof, 18).rotateZ(-Math.PI / 2).translate(-4, 0, 0).scale(1, 0.8, 1);
    const fs = new THREE.Shape();
    fs.moveTo(0, 0);
    fs.lineTo(-1.1, 1.3);
    fs.lineTo(-0.6, 0);
    fs.lineTo(-1.1, -1.3);
    fs.closePath();
    const fluke = new THREE.ExtrudeGeometry(fs, { depth: 0.1, bevelEnabled: false }).rotateX(Math.PI / 2).translate(-4, 0.05, 0);
    const ws = new THREE.Shape();
    ws.moveTo(0, 0.35);
    ws.lineTo(1.9, -0.1);
    ws.lineTo(0.5, -0.45);
    ws.lineTo(0, -0.6);
    ws.closePath();
    const wing = new THREE.ExtrudeGeometry(ws, { depth: 0.05, bevelEnabled: false }).rotateX(-Math.PI / 2);
    const dot = new THREE.SphereGeometry(1, 8, 6);
    return { body, fluke, wing, dot };
  }, []);
  useDisposable([...Object.values(m), ...Object.values(geo)]);
  const spots = useMemo(
    () => Array.from({ length: 16 }, (_, i) => new THREE.Vector3(-3 + i * 0.42, 0.55 + Math.sin(i) * 0.08, (i % 2 ? 1 : -1) * (0.75 - Math.abs(i - 7) * 0.03))),
    [],
  );

  useFrame((s, d) => {
    if (getShared().chapter !== IDX) return;
    const n = live.night;
    const dt = Math.min(d, 0.05);
    const t = s.clock.elapsedTime;
    if (n < 0.02 && live.reefPower < 0.1) swim.current = 0;
    if (n > 0.02) swim.current += dt;
    const w = swim.current;
    if (whale.current) {
      whale.current.visible = w > 0;
      whale.current.position.set(-13 + w * 2.4, 6.3 + Math.sin(w * 0.4) * 0.3, -10.5);
      whale.current.rotation.set(0, 0, Math.sin(w * 0.5) * 0.04);
    }
    if (manta.current) {
      manta.current.visible = w > 0;
      const a = Math.PI * 0.15 + w * 0.32;
      manta.current.position.set(0.4 + Math.cos(a) * 3.8, 4.5 + Math.sin(w * 0.8) * 0.25, 1.2 - Math.sin(a) * 2.6);
      manta.current.rotation.set(0, a + Math.PI, Math.sin(w * 0.9) * 0.15);
      const flap = getShared().reducedMotion ? 0.1 : Math.sin(t * 2.2) * 0.38;
      wingL.current?.rotation.set(0, 0, flap);
      wingR.current?.rotation.set(0, 0, -flap);
    }
  });

  return (
    <>
      <group ref={whale} scale={1.15} visible={false}>
        <mesh geometry={geo.body} material={m.whale} />
        <mesh geometry={geo.fluke} material={m.whale} />
        {[1, -1].map((side) => (
          <mesh key={side} position={[1.6, -0.45, side * 1.0]} rotation={[side * 0.5, side * 0.6, -0.3]} material={m.belly}>
            <boxGeometry args={[1.5, 0.07, 0.45]} />
          </mesh>
        ))}
        {spots.map((p, i) => (
          <mesh key={i} geometry={geo.dot} material={m.spot} position={p} scale={0.13} />
        ))}
      </group>
      <group ref={manta} visible={false}>
        <mesh material={m.manta} scale={[0.32, 0.12, 0.7]}>
          <sphereGeometry args={[1, 14, 10]} />
        </mesh>
        <group ref={wingR}>
          <mesh geometry={geo.wing} material={m.manta} />
        </group>
        <group ref={wingL} scale={[-1, 1, 1]}>
          <mesh geometry={geo.wing} material={m.manta} />
        </group>
        <mesh position={[0, 0, 1.2]} rotation-x={Math.PI / 2} material={m.manta}>
          <cylinderGeometry args={[0.015, 0.03, 1.4, 5]} />
        </mesh>
        {[-1.2, -0.7, 0.7, 1.2].map((x) => (
          <mesh key={x} geometry={geo.dot} material={m.spot} position={[x, 0.05, -0.05]} scale={0.045} />
        ))}
      </group>
    </>
  );
}

export default function ReefWorld() {
  useAnchorCleanup(["skill-0", "skill-1", "skill-2", "skill-3", "reef-hold"]);
  const mats = useMats();
  const power = useRef(0);
  const lanternAnchor = useRef<THREE.Object3D>(null);
  const tmp = useRef({ v: new THREE.Vector3(), ox: 0, oy: 0, label: new THREE.Vector3() });
  useActiveFrame(IDX, 36, 80, (state, dt) => {
    const calm = getShared().reducedMotion;
    const p = live.smooth[IDX];
    const target = Math.max(live.reefTarget, calm ? 0 : 0.05);
    // darkness falls fast; daylight returns slowly
    power.current = damp(power.current, target, target > power.current ? 3.5 : 0.7, dt);
    live.reefPower = power.current;
    const night = smoothstep(0.08, 0.32, power.current);
    live.night = night;
    const bg = state.scene.background as THREE.Color | null;
    bg?.lerpColors(DAY, NIGHT, night);
    const fog = state.scene.fog as THREE.Fog | null;
    if (fog && bg) {
      fog.color.copy(bg);
      fog.far = THREE.MathUtils.lerp(30, 58, night);
    }
    if (rig.ambient) rig.ambient.intensity = THREE.MathUtils.lerp(1.05, 0.28, night);
    if (rig.sun) rig.sun.intensity = THREE.MathUtils.lerp(1.55, 0.12, night);
    if (rig.lamp) {
      rig.lamp.position.copy(LAMP);
      rig.lamp.intensity = night * (5 + (calm ? 0 : Math.sin(state.clock.elapsedTime * 9) * 0.4));
    }
    const pulse = calm ? 1 : 0.7 + 0.3 * Math.sin(state.clock.elapsedTime * 1.8);
    mats.coralRed.emissive.set("#FF5A7A").multiplyScalar(night * 0.55 * pulse);
    mats.coralOrange.emissive.set("#FFB347").multiplyScalar(night * 0.5 * pulse);
    mats.brain.emissive.set("#FF8BE0").multiplyScalar(night * 0.4 * pulse);
    mats.fan.emissive.set("#B38CFF").multiplyScalar(night * 0.5 * pulse);
    const isNight = night > 0.5 ? "true" : "false";
    if (document.documentElement.dataset.night !== isNight) document.documentElement.dataset.night = isNight;

    // descend from the surface (0–.18) · glide over the reef (.18–.78) · into the porthole
    const k = tmp.current;
    const par = calm ? 0 : 1 - smoothstep(0.72, 0.8, p);
    k.ox = damp(k.ox, live.pointerX * 0.3 * par, 2.5, dt);
    k.oy = damp(k.oy, live.pointerY * 0.15 * par, 2.5, dt);
    const [i, f] = p < 0.18 ? [0, smoothstep(0, 0.18, p)] : p < 0.78 ? [1, (p - 0.18) / 0.6] : [2, Math.pow((p - 0.78) / 0.22, 1.7)];
    k.v.lerpVectors(CAM[i], CAM[i + 1], f);
    state.camera.position.set(k.v.x + k.ox, k.v.y + k.oy, k.v.z);
    k.label.lerpVectors(LOOK[i], LOOK[i + 1], f);
    state.camera.lookAt(k.label);

    JELLIES.forEach((j, i) => {
      k.label.set(j.pos.x, j.pos.y + 0.55 + power.current * 0.35, j.pos.z);
      writeAnchor(`skill-${i}`, k.label, state.camera, state.size);
    });
    if (lanternAnchor.current) {
      lanternAnchor.current.getWorldPosition(k.v);
      writeAnchor("reef-hold", k.v, state.camera, state.size);
    }
  });

  // leaving the reef: the night (and its UI colours) end with it
  useFrame(() => {
    if (getShared().chapter === IDX) return;
    if (document.documentElement.dataset.night === "true") document.documentElement.dataset.night = "false";
  });

  return (
    <>
      <Surface />
      <Plankton />
      <NightCreatures />
      <Seafloor mats={mats} />
      <Kelp mats={mats} />
      <Jellyfish power={power} />
      <School mats={mats} power={power} />
      <Bubbles mats={mats} power={power} />
      <Lantern mats={mats} power={power} anchor={lanternAnchor} />
      <Wreck mats={mats} />
      <BakedShadow position={[LANTERN.x, 0.01, LANTERN.z]} size={[1.8, 1.8]} opacity={0.25} color="#1d3a44" />
      <BakedShadow shape="rect" position={[PORTHOLE.x, 0.01, PORTHOLE.z]} size={[7.2, 1.4]} opacity={0.22} color="#1d3a44" />
    </>
  );
}
