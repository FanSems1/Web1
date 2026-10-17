"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { damp, getShared, live, smoothstep } from "@/lib/experience";
import { rng, useDisposable, useActiveFrame } from "../helpers";
import { toon } from "../ink";
import { ci } from "@/lib/chapters";

const IDX = ci("city");

const WALLS = ["#FBF6EC", "#F6DCC8", "#EDE6F4", "#E2EEF2", "#F7E7C4"];
const ROOFS = ["#E07A5F", "#5E86A6", "#E9B44C", "#5F8C7F", "#C8553D"];
const GREENS = ["#7FB069", "#9CC97E", "#5E9A5C", "#B3D68C"];

type Island = { x: number; y: number; z: number; r: number; depth: number; seed: number };
const ISLANDS: Island[] = [
  { x: 0, y: 0, z: 0, r: 3.3, depth: 3.6, seed: 1 },
  { x: 6.4, y: -0.6, z: -1.8, r: 1.7, depth: 2.3, seed: 2 },
  { x: -2.9, y: 0.4, z: -6.3, r: 1.5, depth: 2.1, seed: 3 },
];

function rockGeometry(r: number, depth: number, seed: number) {
  const rand = rng(seed * 97);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2((r * 0.94 * Math.pow(1 - t, 0.7) + 0.08) * (0.9 + rand() * 0.2), -t * depth));
  }
  const g = new THREE.LatheGeometry(pts, 11);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + Math.sin(v.x * 2.1 + seed) * 0.07 + Math.cos(v.z * 1.7 + v.y) * 0.07;
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}

function placeHouses(isl: Island, count: number, road: number) {
  const rand = rng(isl.seed * 13);
  const out: { x: number; z: number; w: number; d: number; h: number; rot: number; wall: number; roof: number }[] = [];
  let tries = 0;
  while (out.length < count && tries++ < 600) {
    const a = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * (isl.r - 0.45);
    if (dist < (isl.r > 2 ? 0.85 : 0.25)) continue;
    if (road > 0 && Math.abs(dist - road) < 0.38) continue;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 0.52)) continue;
    out.push({ x, z, w: 0.36 + rand() * 0.2, d: 0.32 + rand() * 0.16, h: 0.34 + rand() * 0.36, rot: -a + Math.PI / 2, wall: Math.floor(rand() * WALLS.length), roof: Math.floor(rand() * ROOFS.length) });
  }
  return out;
}

function Islands() {
  const rocks = useMemo(() => ISLANDS.map((i) => rockGeometry(i.r, i.depth, i.seed)), []);
  const m = useMemo(() => ({ grass: toon("#8CC071"), earth: toon("#E8C9A0"), rock: toon("#C9A27E") }), []);
  useDisposable([...rocks, ...Object.values(m)]);
  return (
    <>
      {ISLANDS.map((isl, k) => (
        <group key={isl.seed} position={[isl.x, isl.y, isl.z]}>
          <mesh position-y={0.12} material={m.grass}>
            <cylinderGeometry args={[isl.r, isl.r * 0.985, 0.24, 48]} />
          </mesh>
          <mesh position-y={-0.14} material={m.earth}>
            <cylinderGeometry args={[isl.r * 0.985, isl.r * 0.93, 0.3, 40]} />
          </mesh>
          <mesh geometry={rocks[k]} position-y={-0.28} material={m.rock} />
        </group>
      ))}
    </>
  );
}

function Houses() {
  const walls = useRef<THREE.InstancedMesh>(null);
  const roofs = useRef<THREE.InstancedMesh>(null);
  const doors = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => ISLANDS.flatMap((isl, i) => placeHouses(isl, i === 0 ? 24 : 6, i === 0 ? isl.r * 0.62 : 0).map((h) => ({ ...h, isl }))), []);
  const geo = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const roof = new THREE.ConeGeometry(0.75, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
    return { box, roof };
  }, []);
  const mats = useMemo(() => ({ wall: toon("#ffffff"), roof: toon("#ffffff"), door: toon("#2A3B44") }), []);
  useDisposable([geo.box, geo.roof, ...Object.values(mats)]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    data.forEach((h, i) => {
      const base = new THREE.Vector3(h.isl.x + h.x, h.isl.y + 0.24, h.isl.z + h.z);
      q.setFromAxisAngle(up, h.rot);
      m.compose(base, q, new THREE.Vector3(h.w, h.h, h.d));
      walls.current!.setMatrixAt(i, m);
      walls.current!.setColorAt(i, c.set(WALLS[h.wall]));
      m.compose(base.clone().setY(base.y + h.h), q, new THREE.Vector3(h.w * 1.05, 0.24 + h.w * 0.35, h.d * 1.05));
      roofs.current!.setMatrixAt(i, m);
      roofs.current!.setColorAt(i, c.set(ROOFS[h.roof]));
      m.compose(new THREE.Vector3(0, 0, h.d / 2 + 0.01).applyQuaternion(q).add(base), q, new THREE.Vector3(0.1, 0.18, 0.02));
      doors.current!.setMatrixAt(i, m);
    });
    for (const r of [walls, roofs, doors]) {
      r.current!.instanceMatrix.needsUpdate = true;
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true;
      r.current!.computeBoundingSphere();
    }
  }, [data]);

  return (
    <>
      <instancedMesh ref={walls} args={[geo.box, mats.wall, data.length]} />
      <instancedMesh ref={roofs} args={[geo.roof, mats.roof, data.length]} />
      <instancedMesh ref={doors} args={[geo.box, mats.door, data.length]} />
    </>
  );
}

function Trees() {
  const canopy = useRef<THREE.InstancedMesh>(null);
  const trunk = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => {
    const rand = rng(404);
    return ISLANDS.flatMap((isl, k) =>
      Array.from({ length: k === 0 ? 26 : 8 }, (_, i) => {
        const a = rand() * Math.PI * 2;
        const dist = k === 0 && i < 7 ? 1.3 + rand() * 0.25 : isl.r - 0.28 - rand() * 0.35;
        return { x: isl.x + Math.cos(a) * dist, y: isl.y + 0.24, z: isl.z + Math.sin(a) * dist, s: 0.17 + rand() * 0.12, tone: Math.floor(rand() * GREENS.length) };
      }),
    );
  }, []);
  const geo = useMemo(() => ({ blob: new THREE.IcosahedronGeometry(1, 1), stem: new THREE.CylinderGeometry(0.12, 0.16, 1, 6).translate(0, 0.5, 0) }), []);
  const mats = useMemo(() => ({ leaf: toon("#ffffff"), wood: toon("#9C6B4E") }), []);
  useDisposable([geo.blob, geo.stem, mats.leaf, mats.wood]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    trees.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s * 0.5, t.s * 1.4, t.s * 0.5));
      trunk.current!.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, t.y + t.s * 1.9, t.z), q, new THREE.Vector3(t.s * 1.15, t.s * 1.05, t.s * 1.15));
      canopy.current!.setMatrixAt(i, m);
      canopy.current!.setColorAt(i, c.set(GREENS[t.tone]));
    });
    for (const r of [canopy, trunk]) {
      r.current!.instanceMatrix.needsUpdate = true;
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true;
      r.current!.computeBoundingSphere();
    }
  }, [trees]);
  return (
    <>
      <instancedMesh ref={canopy} args={[geo.blob, mats.leaf, trees.length]} />
      <instancedMesh ref={trunk} args={[geo.stem, mats.wood, trees.length]} />
    </>
  );
}

function Landmarks() {
  const m = useMemo(() => ({ wall: toon("#FBF6EC"), roof: toon("#5E86A6"), red: toon("#C8553D"), gold: toon("#E9B44C"), road: toon("#F3E6CF"), wood: toon("#C9976B") }), []);
  useDisposable(Object.values(m));
  const blades = useRef<THREE.Group>(null);
  const cars = useRef<THREE.Group>(null);
  useFrame((s, d) => {
    if (getShared().reducedMotion) return;
    if (blades.current) blades.current.rotation.z += Math.min(d, 0.05) * 0.8;
    if (cars.current) cars.current.rotation.y -= Math.min(d, 0.05) * 0.12;
  });
  const bridges = useMemo(
    () =>
      [ISLANDS[1], ISLANDS[2]].map((to) => {
        const from = ISLANDS[0];
        const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
        const a = new THREE.Vector3(from.x, from.y + 0.24, from.z).addScaledVector(dir, from.r - 0.1);
        const b = new THREE.Vector3(to.x, to.y + 0.24, to.z).addScaledVector(dir, -(to.r - 0.1));
        const mid = a.clone().lerp(b, 0.5);
        mid.y += 0.5;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        return Array.from({ length: 20 }, (_, i) => {
          const t = i / 19;
          const tan = curve.getTangent(t);
          return { p: curve.getPoint(t), rot: Math.atan2(tan.x, tan.z) };
        });
      }),
    [],
  );
  const isl3 = ISLANDS[2];
  const road = ISLANDS[0].r * 0.62;
  return (
    <>
      <group position={[0, 0.24, 0]}>
        <mesh position-y={0.95} material={m.wall}>
          <boxGeometry args={[0.55, 1.6, 0.55]} />
        </mesh>
        <mesh position-y={1.95} material={m.gold}>
          <boxGeometry args={[0.65, 0.3, 0.65]} />
        </mesh>
        <mesh position-y={2.5} rotation-y={Math.PI / 4} material={m.roof}>
          <coneGeometry args={[0.52, 0.85, 4]} />
        </mesh>
      </group>
      <mesh position-y={0.245} rotation-x={-Math.PI / 2} material={m.road}>
        <ringGeometry args={[road - 0.15, road + 0.15, 64]} />
      </mesh>
      <group ref={cars}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * road, 0.3, Math.sin(a) * road]} rotation-y={-a} material={i % 2 ? m.red : m.gold}>
              <boxGeometry args={[0.1, 0.1, 0.2]} />
            </mesh>
          );
        })}
      </group>
      <group position={[isl3.x + 0.3, isl3.y + 0.24, isl3.z + 0.2]} rotation-y={0.6}>
        <mesh position-y={0.5} material={m.wall}>
          <cylinderGeometry args={[0.16, 0.26, 1, 10]} />
        </mesh>
        <mesh position-y={1.12} material={m.red}>
          <coneGeometry args={[0.24, 0.32, 10]} />
        </mesh>
        <group ref={blades} position={[0, 0.92, 0.22]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation-z={(i * Math.PI) / 2} material={m.wall}>
              <boxGeometry args={[0.08, 0.95, 0.02]} />
            </mesh>
          ))}
        </group>
      </group>
      {bridges.map((planks, k) => (
        <group key={k}>
          {planks.map((pl, i) => (
            <mesh key={i} position={pl.p} rotation={[0, pl.rot, 0]} material={m.wood}>
              <boxGeometry args={[0.34, 0.03, 0.09]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** cel-shaded cumulus: puffs that read as cartoon clouds once inked */
function Clouds() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const drift = useRef<THREE.Group>(null);
  const puffs = useMemo(() => {
    const rand = rng(9);
    const out: { p: THREE.Vector3; s: number }[] = [];
    const cluster = (cx: number, cy: number, cz: number, size: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * size;
        out.push({ p: new THREE.Vector3(cx + Math.cos(a) * d, cy + rand() * size * 0.3, cz + Math.sin(a) * d * 0.6), s: size * (0.5 + rand() * 0.45) });
      }
    };
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rand() * 0.3;
      const d = 3 + rand() * 14;
      cluster(Math.cos(a) * d, -4.8 - rand() * 1.5, Math.sin(a) * d, 1.7 + rand() * 1.6, 5);
    }
    // the bank the camera starts inside and flies forward out of
    cluster(16, 9.6, 15.6, 2.6, 12);
    cluster(13.5, 8.4, 13.4, 2, 8);
    (
      [
        [-6, 0.8, 3, 1.1],
        [9, 1.6, -3, 1],
        [-8, -0.6, -5, 1.3],
        [3, 2.2, -10, 1.2],
      ] as const
    ).forEach(([x, y, z, s]) => cluster(x, y, z, s, 6));
    return out;
  }, []);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  const mat = useMemo(() => toon("#FFFFFF"), []);
  useDisposable([geo, mat]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    puffs.forEach((p, i) => {
      m.compose(p.p, q, new THREE.Vector3(p.s, p.s * 0.7, p.s));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [puffs]);
  useFrame((s, d) => {
    if (drift.current && !getShared().reducedMotion) drift.current.rotation.y += Math.min(d, 0.05) * 0.006;
  });
  return (
    <group ref={drift}>
      <instancedMesh ref={ref} args={[geo, mat, puffs.length]} />
    </group>
  );
}

/** far-off islands so the wider view reads as a whole archipelago */
function FarIslands() {
  const m = useMemo(() => ({ grass: toon("#9CC97E"), rock: toon("#C9A27E"), wall: toon("#FBF6EC"), roof: toon("#E07A5F") }), []);
  useDisposable(Object.values(m));
  const list = useMemo(() => {
    const r = rng(71);
    return Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + r() * 0.4;
      const d = 22 + r() * 18;
      return { x: Math.cos(a) * d, y: -3 + r() * 6, z: Math.sin(a) * d, s: 0.8 + r() * 1.2, houses: 1 + Math.floor(r() * 3) };
    });
  }, []);
  return (
    <>
      {list.map((it, i) => (
        <group key={i} position={[it.x, it.y, it.z]} scale={it.s}>
          <mesh position-y={0.1} material={m.grass}>
            <cylinderGeometry args={[1.4, 1.38, 0.2, 20]} />
          </mesh>
          <mesh position-y={-0.9} rotation-x={Math.PI} material={m.rock}>
            <coneGeometry args={[1.35, 1.8, 9]} />
          </mesh>
          {Array.from({ length: it.houses }, (_, k) => (
            <group key={k} position={[(k - (it.houses - 1) / 2) * 0.7, 0.2, 0]}>
              <mesh position-y={0.25} material={m.wall}>
                <boxGeometry args={[0.45, 0.5, 0.4]} />
              </mesh>
              <mesh position-y={0.68} rotation-y={Math.PI / 4} material={m.roof}>
                <coneGeometry args={[0.38, 0.36, 4]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

export default function CityWorld() {
    const v = useRef({ yaw: 0, pitch: 0, target: new THREE.Vector3() });

  useActiveFrame(IDX, 32, 120, (state, dt) => {
    const p = live.smooth[IDX];
    const s = v.current;
    const calm = getShared().reducedMotion;
    s.yaw = damp(s.yaw, live.cityYaw, calm ? 30 : 3, dt);
    s.pitch = damp(s.pitch, live.cityPitch, calm ? 30 : 3, dt);

    // emerge from the cloud bank → orbit → dive through the cloud sea
    const emerge = smoothstep(0, 0.18, p);
    const dive = smoothstep(0.78, 1, p);
    const dist = THREE.MathUtils.lerp(36, 25, emerge) - dive * 9;
    const yaw = 0.75 - p * 1.5 + s.yaw;
    const pitch = THREE.MathUtils.lerp(0.32, 1.25, dive) + s.pitch;
    s.target.set(0.6, THREE.MathUtils.lerp(0.4, -7, dive * dive), -0.8);
    const cam = state.camera;
    cam.position.set(
      s.target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      s.target.y + Math.sin(pitch) * dist + (1 - emerge) * 2,
      s.target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    cam.lookAt(s.target);
  });

  return (
    <>
      <Islands />
      <Houses />
      <Trees />
      <Landmarks />
      <Clouds />
      <FarIslands />
    </>
  );
}
