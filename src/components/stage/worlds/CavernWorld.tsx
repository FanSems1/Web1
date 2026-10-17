"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CHAPTERS, ci } from "@/lib/chapters";
import { damp, getShared, live, smoothstep } from "@/lib/experience";
import { rig } from "../Stage";
import { rng, useActiveFrame, useAnchorCleanup, useDisposable, useGlowTexture, writeAnchor } from "../helpers";
import { fxLayer, toon } from "../ink";

const IDX = ci("cavern");
const NEXT_BG = new THREE.Color(CHAPTERS[ci("observatory")].bg);
const CAVE_C = new THREE.Vector3(0, 2, -4);
const CAVE_R = 19;
const GEM = new THREE.Vector3(0, 2.7, -6.5);
const PALETTE = ["#A77BF0", "#F28DC8", "#62D8D2", "#F2C14E", "#CFE6FF"];

/** the four skill groups: one crystal cluster each */
const CLUSTERS = [
  { pos: new THREE.Vector3(-4.6, 0, 1.4), color: "#A77BF0" },
  { pos: new THREE.Vector3(-1.6, 0, -0.6), color: "#F28DC8" },
  { pos: new THREE.Vector3(1.6, 0, -0.6), color: "#62D8D2" },
  { pos: new THREE.Vector3(4.6, 0, 1.4), color: "#F2C14E" },
];

/** camera: drop in through the roof → glide across the cavern → into the gem */
const CAM = [new THREE.Vector3(0, 15, 10), new THREE.Vector3(0.6, 4.6, 13.5), new THREE.Vector3(-0.6, 3.8, 9.5), new THREE.Vector3(0, 2.7, -5.6)];
const LOOK = [new THREE.Vector3(0, 1.5, -2), new THREE.Vector3(0, 2.2, -1.5), new THREE.Vector3(0.2, 2.4, -3), new THREE.Vector3(0, 2.7, -8)];

/** a hexagonal crystal with a pointed tip, base at y=0, height ≈ 1.35 */
function crystalGeometry() {
  const g = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1), new THREE.Vector2(0, 1.35)], 6);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}

function useCrystal() {
  const geo = useMemo(() => crystalGeometry(), []);
  useDisposable([geo]);
  return geo;
}

/** faceted cave walls studded with hundreds of crystals pointing inward */
function Cave() {
  const crystal = useCrystal();
  const wall = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(CAVE_R, 3);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    const r = rng(17);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.multiplyScalar(1 + (Math.sin(v.x * 0.5) * Math.cos(v.z * 0.4) + (r() - 0.5)) * 0.06);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    // icosahedron geometry is already non-indexed: flat facets come for free
    g.computeVertexNormals();
    return g;
  }, []);
  const m = useMemo(() => ({ rock: toon("#3C2B66", { side: THREE.BackSide }), floor: toon("#4A3878"), stone: toon("#5B4A8A"), gem: toon("#ffffff") }), []);
  useDisposable([wall, ...Object.values(m)]);

  const inst = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const rockGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  useDisposable([rockGeo]);
  const layout = useMemo(() => {
    const r = rng(5);
    const out: { m: THREE.Matrix4; c: string }[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    // clusters on walls and ceiling, pointing toward the middle of the cave
    for (let k = 0; k < 46; k++) {
      const dir = new THREE.Vector3(r() - 0.5, r() * 1.2 - 0.25, r() - 0.5).normalize();
      if (dir.z > 0.55 && dir.y < 0.4) continue; // keep the camera's side clear
      const base = CAVE_C.clone().addScaledVector(dir, CAVE_R * 0.95);
      if (base.y < 0.2) base.y = 0.2;
      const color = PALETTE[Math.floor(r() * PALETTE.length)];
      const n = 4 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const inward = CAVE_C.clone().sub(base).normalize().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
        q.setFromUnitVectors(up, inward);
        const w = 0.25 + r() * 0.55;
        const h = 1 + r() * 3.2;
        const p = base.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.6));
        out.push({ m: new THREE.Matrix4().compose(p, q.clone(), new THREE.Vector3(w, h, w)), c: color });
      }
    }
    // a scatter of small floor crystals and rocks
    const rockList: THREE.Matrix4[] = [];
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const d = 3 + r() * 13;
      const p = new THREE.Vector3(Math.cos(a) * d, 0, -4 + Math.sin(a) * d);
      if (p.z > 4 && Math.abs(p.x) < 4) continue;
      if (i % 3 === 0) {
        const s = 0.3 + r() * 0.8;
        rockList.push(new THREE.Matrix4().compose(p.setY(s * 0.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 3, r())), new THREE.Vector3(s * 1.4, s * 0.7, s)));
      } else {
        q.setFromUnitVectors(up, new THREE.Vector3((r() - 0.5) * 0.8, 1, (r() - 0.5) * 0.8).normalize());
        const w = 0.12 + r() * 0.22;
        out.push({ m: new THREE.Matrix4().compose(p, q.clone(), new THREE.Vector3(w, 0.4 + r() * 1.2, w)), c: PALETTE[Math.floor(r() * PALETTE.length)] });
      }
    }
    return { out, rockList };
  }, []);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    layout.out.forEach((it, i) => {
      inst.current!.setMatrixAt(i, it.m);
      inst.current!.setColorAt(i, c.set(it.c));
    });
    layout.rockList.forEach((mm, i) => rocks.current!.setMatrixAt(i, mm));
    for (const r of [inst, rocks]) {
      r.current!.instanceMatrix.needsUpdate = true;
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true;
      r.current!.computeBoundingSphere();
    }
  }, [layout]);

  return (
    <>
      <mesh geometry={wall} material={m.rock} position={CAVE_C} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -4]} material={m.floor}>
        <circleGeometry args={[CAVE_R, 48]} />
      </mesh>
      <instancedMesh ref={inst} args={[crystal, m.gem, layout.out.length]} />
      <instancedMesh ref={rocks} args={[rockGeo, m.stone, layout.rockList.length]} />
    </>
  );
}

/** the four skill clusters: they lift, turn and glow while resonating */
function Clusters({ power, tops }: { power: React.RefObject<number>; tops: React.RefObject<THREE.Vector3[]> }) {
  const crystal = useCrystal();
  const groups = useRef<(THREE.Group | null)[]>([]);
  const halos = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const glow = useGlowTexture("radial");
  const mats = useMemo(() => CLUSTERS.map((c) => toon(c.color, { emissive: new THREE.Color(c.color), emissiveIntensity: 0.15 })), []);
  const base = useMemo(() => toon("#5B4A8A"), []);
  useDisposable([...mats, base]);
  const shapes = useMemo(() => {
    const r = rng(29);
    return CLUSTERS.map(() =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + r();
        const centre = i === 0;
        return {
          pos: centre ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55),
          rot: centre ? new THREE.Euler(0, r() * 3, 0) : new THREE.Euler(Math.sin(a) * 0.45, r() * 3, -Math.cos(a) * 0.45),
          scale: centre ? new THREE.Vector3(0.42, 2.0, 0.42) : new THREE.Vector3(0.18 + r() * 0.12, 0.7 + r() * 0.8, 0.18 + r() * 0.12),
        };
      }),
    );
  }, []);
  useFrame((s) => {
    if (getShared().chapter !== IDX) return;
    const p = power.current;
    const t = s.clock.elapsedTime;
    const calm = getShared().reducedMotion;
    groups.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = 0.45 + p * 0.8 + (calm ? 0 : Math.sin(t * 1.3 + i) * 0.05 * (0.4 + p));
      if (!calm) g.rotation.y += 0.002 + p * 0.02;
      mats[i].emissiveIntensity = 0.15 + p * 0.85 + (calm ? 0 : Math.sin(t * 3 + i) * 0.08 * p);
      const h = halos.current[i];
      if (h) h.opacity = 0.18 + p * 0.6;
      tops.current[i]?.set(CLUSTERS[i].pos.x, g.position.y + 3.0, CLUSTERS[i].pos.z);
    });
  });
  return (
    <>
      {CLUSTERS.map((c, i) => (
        <group key={i} position={c.pos}>
          <mesh position-y={0.22} material={base}>
            <cylinderGeometry args={[0.95, 1.15, 0.44, 7]} />
          </mesh>
          <group ref={(el) => void (groups.current[i] = el)} position-y={0.45}>
            {shapes[i].map((sh, k) => (
              <mesh key={k} geometry={crystal} material={mats[i]} position={sh.pos} rotation={sh.rot} scale={sh.scale} />
            ))}
            <sprite ref={fxLayer} position-y={1.4} scale={4.2}>
              <spriteMaterial ref={(el) => void (halos.current[i] = el)} map={glow} color={c.color} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </sprite>
          </group>
        </group>
      ))}
    </>
  );
}

/** a cracked-open geode with a giant gem that splits and blazes on resonance */
function Geode({ power, exit }: { power: React.RefObject<number>; exit: React.RefObject<number> }) {
  const crystal = useCrystal();
  const top = useRef<THREE.Group>(null);
  const gemMesh = useRef<THREE.Mesh>(null);
  const bottom = useRef<THREE.Group>(null);
  const gemMat = useMemo(() => toon("#FF9AD5", { emissive: new THREE.Color("#FF6FCF"), emissiveIntensity: 0.3 }), []);
  const m = useMemo(() => ({ shell: toon("#6B5A92", { side: THREE.DoubleSide }), lining: toon("#E2C6FF") }), []);
  const shellGeo = useMemo(() => new THREE.SphereGeometry(2.9, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.66).rotateX(-Math.PI / 2), []);
  const halfGeo = useMemo(() => new THREE.ConeGeometry(1.05, 1.25, 8).translate(0, 0.625, 0), []);
  useDisposable([gemMat, ...Object.values(m), shellGeo, halfGeo]);
  const lining = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const portal = useRef<THREE.MeshBasicMaterial>(null);
  const portalMesh = useRef<THREE.Mesh>(null);
  const glow = useGlowTexture("radial");
  const pink = useMemo(() => new THREE.Color("#FF6FCF"), []);
  const n = 70;
  useLayoutEffect(() => {
    const r = rng(41);
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    const mm = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      // points on the inner shell (back hemisphere), pointing to the centre
      const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, -0.2 - r()).normalize();
      const p = dir.clone().multiplyScalar(2.65);
      q.setFromUnitVectors(up, dir.clone().negate());
      const w = 0.12 + r() * 0.16;
      mm.compose(p, q, new THREE.Vector3(w, 0.35 + r() * 0.6, w));
      lining.current!.setMatrixAt(i, mm);
    }
    lining.current!.instanceMatrix.needsUpdate = true;
    lining.current!.computeBoundingSphere();
  }, []);
  useFrame((s) => {
    if (getShared().chapter !== IDX) return;
    const p = power.current;
    const e = exit.current;
    const calm = getShared().reducedMotion;
    const t = s.clock.elapsedTime;
    const split = smoothstep(0.2, 0.9, p) * 0.55;
    const spin = calm ? 0 : t * (0.3 + p * 1.6);
    top.current?.position.set(0, split, 0);
    bottom.current?.position.set(0, -split, 0);
    if (top.current) top.current.rotation.y = spin;
    if (bottom.current) bottom.current.rotation.y = -spin;
    // mutate through the mesh, not the memoised value
    const gm = gemMesh.current?.material as THREE.MeshToonMaterial | undefined;
    if (gm) {
      gm.emissive.copy(pink).lerp(NEXT_BG, e);
      gm.emissiveIntensity = 0.3 + p * 1.2 + e * 1.5;
    }
    if (halo.current) halo.current.opacity = 0.25 + p * 0.6 + e * 0.5;
    if (portal.current && portalMesh.current) {
      portalMesh.current.visible = e > 0.6;
      portal.current.opacity = smoothstep(0.6, 0.95, e);
    }
  });
  return (
    <group position={GEM}>
      <mesh geometry={shellGeo} material={m.shell} />
      <instancedMesh ref={lining} args={[crystal, m.lining, n]} />
      <group ref={top}>
        <mesh ref={gemMesh} geometry={halfGeo} material={gemMat} />
      </group>
      <group ref={bottom}>
        <mesh geometry={halfGeo} material={gemMat} rotation-x={Math.PI} />
      </group>
      <sprite ref={fxLayer} scale={7}>
        <spriteMaterial ref={halo} map={glow} color="#FFB3E6" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* inside the gem: the night sky of the next world */}
      <mesh ref={(el) => { portalMesh.current = el; fxLayer(el); }} visible={false}>
        <sphereGeometry args={[1.2, 24, 16]} />
        <meshBasicMaterial ref={portal} color={NEXT_BG} side={THREE.BackSide} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** light leaping from each cluster to the gem, and between neighbours */
function Beams({ power, tops }: { power: React.RefObject<number>; tops: React.RefObject<THREE.Vector3[]> }) {
  const beams = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const pairs = useMemo(() => [...CLUSTERS.map((_, i) => [i, -1] as const), [0, 1] as const, [1, 2] as const, [2, 3] as const], []);
  const geo = useMemo(() => new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), []);
  useDisposable([geo]);
  const tmp = useRef({ a: new THREE.Vector3(), b: new THREE.Vector3() });
  useFrame((s) => {
    if (getShared().chapter !== IDX) return;
    const p = power.current;
    const t = s.clock.elapsedTime;
    pairs.forEach(([i, j], k) => {
      const m = beams.current[k];
      const mat = mats.current[k];
      if (!m || !mat) return;
      const a = tmp.current.a.copy(tops.current[i]);
      const b = j < 0 ? tmp.current.b.copy(GEM) : tmp.current.b.copy(tops.current[j]);
      // beams to the gem arrive first, the ring between clusters a moment later
      const on = smoothstep(j < 0 ? 0.25 : 0.55, j < 0 ? 0.6 : 0.85, p);
      m.visible = on > 0.01;
      m.position.copy(a);
      m.lookAt(b);
      m.scale.set(1 + Math.sin(t * 9 + k) * 0.3, 1 + Math.sin(t * 9 + k) * 0.3, a.distanceTo(b) * on);
      mat.opacity = on * 0.85;
    });
  });
  return (
    <>
      {pairs.map(([i], k) => (
        <mesh key={k} ref={(el) => { beams.current[k] = el; fxLayer(el); }} geometry={geo} visible={false}>
          <meshBasicMaterial ref={(el) => void (mats.current[k] = el)} color={CLUSTERS[i].color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

/** shards drifting through the air, orbiting faster as the cave resonates */
function Shards({ power }: { power: React.RefObject<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 70;
  const list = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: N }, () => ({ a: r() * Math.PI * 2, rad: 3 + r() * 9, y: 1 + r() * 9, sp: 0.04 + r() * 0.08, s: 0.08 + r() * 0.18, spin: r() * 6, c: PALETTE[Math.floor(r() * PALETTE.length)] }));
  }, []);
  const geo = useMemo(() => new THREE.OctahedronGeometry(1, 0).scale(0.6, 1.2, 0.6), []);
  const mat = useMemo(() => toon("#ffffff"), []);
  useDisposable([geo, mat]);
  const tmp = useRef({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() });
  useLayoutEffect(() => {
    const c = new THREE.Color();
    list.forEach((it, i) => ref.current!.setColorAt(i, c.set(it.c)));
    ref.current!.instanceColor!.needsUpdate = true;
  }, [list]);
  useFrame((st, d) => {
    if (getShared().chapter !== IDX) return;
    const k = tmp.current;
    const dt = getShared().reducedMotion ? 0 : Math.min(d, 0.05);
    const p = power.current;
    list.forEach((it, i) => {
      it.a += dt * it.sp * (1 + p * 5);
      it.spin += dt * (0.6 + p * 4);
      const rad = it.rad * (1 - p * 0.25);
      k.p.set(GEM.x + Math.cos(it.a) * rad, it.y + Math.sin(it.a * 2) * 0.3, GEM.z + 3 + Math.sin(it.a) * rad);
      k.e.set(it.spin * 0.7, it.spin, 0);
      k.q.setFromEuler(k.e);
      k.s.setScalar(it.s);
      k.m.compose(k.p, k.q, k.s);
      ref.current!.setMatrixAt(i, k.m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, N]} frustumCulled={false} />;
}

/** a ring of light that sweeps the floor on each resonance pulse */
function Pulse({ power }: { power: React.RefObject<number> }) {
  const mesh = useRef<THREE.Mesh | null>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(0);
  useFrame((_, d) => {
    if (getShared().chapter !== IDX || !mesh.current || !mat.current) return;
    const p = power.current;
    if (p > 0.35 && !getShared().reducedMotion) t.current = (t.current + Math.min(d, 0.05) * 0.7) % 1;
    else t.current = 0;
    const k = t.current;
    mesh.current.visible = k > 0;
    mesh.current.scale.setScalar(0.5 + k * 16);
    mat.current.opacity = (1 - k) * 0.6 * smoothstep(0.35, 0.6, p);
  });
  return (
    <mesh ref={(el) => { mesh.current = el; fxLayer(el); }} rotation-x={-Math.PI / 2} position={[GEM.x, 0.05, GEM.z + 2]} visible={false}>
      <ringGeometry args={[0.92, 1, 64]} />
      <meshBasicMaterial ref={mat} color="#FFC8F2" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function CavernWorld() {
  useAnchorCleanup(["skill-0", "skill-1", "skill-2", "skill-3"]);
  const power = useRef(0);
  const exit = useRef(0);
  const tops = useRef(CLUSTERS.map((c) => c.pos.clone().setY(3.4)));
  const k = useRef({ v: new THREE.Vector3(), look: new THREE.Vector3(), ox: 0, oy: 0 });
  const lampColor = useMemo(() => new THREE.Color("#FF8FD8"), []);

  useActiveFrame(IDX, 40, 90, (state, dt) => {
    const calm = getShared().reducedMotion;
    const p = live.smooth[IDX];
    const target = live.resonanceTarget;
    power.current = calm ? target : damp(power.current, target, target > power.current ? 3 : 0.9, dt);
    live.resonance = power.current;
    live.glow = power.current * 0.75;
    exit.current = smoothstep(0.82, 0.97, p);

    if (rig.ambient) rig.ambient.intensity = THREE.MathUtils.lerp(0.95, 0.55, power.current);
    if (rig.lamp) {
      rig.lamp.color.copy(lampColor);
      rig.lamp.position.copy(GEM);
      rig.lamp.intensity = 2 + power.current * 9;
    }

    const s = k.current;
    const par = calm ? 0 : 1 - smoothstep(0.72, 0.8, p);
    s.ox = damp(s.ox, live.pointerX * 0.4 * par, 2.5, dt);
    s.oy = damp(s.oy, live.pointerY * 0.2 * par, 2.5, dt);
    const [i, f] = p < 0.18 ? [0, smoothstep(0, 0.18, p)] : p < 0.78 ? [1, (p - 0.18) / 0.6] : [2, Math.pow((p - 0.78) / 0.22, 1.7)];
    s.v.lerpVectors(CAM[i], CAM[i + 1], f);
    state.camera.position.set(s.v.x + s.ox, s.v.y + s.oy, s.v.z);
    s.look.lerpVectors(LOOK[i], LOOK[i + 1], f);
    state.camera.lookAt(s.look);

    tops.current.forEach((top, n) => writeAnchor(`skill-${n}`, top, state.camera, state.size));
  });

  return (
    <>
      <Cave />
      <Clusters power={power} tops={tops} />
      <Geode power={power} exit={exit} />
      <Beams power={power} tops={tops} />
      <Shards power={power} />
      <Pulse power={power} />
    </>
  );
}
