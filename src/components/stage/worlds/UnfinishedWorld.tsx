"use client";


import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { damp, getShared, live, smoothstep } from "@/lib/experience";
import { BakedShadow, rng, useDisposable, useActiveFrame } from "../helpers";
import { fxLayer, toon } from "../ink";
import { ci } from "@/lib/chapters";

const IDX = ci("unfinished");

const STONE = "#FBF7EF";
const ACCENTS = ["#A9CBDC", "#F2C14E", "#93AA82", "#D9A291"];

type Kind = "block" | "step" | "drum" | "voussoir" | "roof" | "slab";
type Piece = { kind: Kind; home: THREE.Vector3; homeRot: THREE.Euler; away: THREE.Vector3; awayRot: THREE.Euler; scale: THREE.Vector3; color: string; phase: number; order: number };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const E = (x: number, y: number, z: number) => new THREE.Euler(x, y, z);
const local = (o: THREE.Vector3, r: number, x: number, y: number, z: number) => V(x, y, z).applyAxisAngle(V(0, 1, 0), r).add(o);

/** the plan: what is already built and what is still floating */
function usePlan() {
  return useMemo(() => {
    const rand = rng(88);
    const built: { kind: Kind; pos: THREE.Vector3; rot: THREE.Euler; scale: THREE.Vector3 }[] = [];
    const floating: Piece[] = [];
    const float = (kind: Kind, home: THREE.Vector3, homeRot: THREE.Euler, scale: THREE.Vector3, lift = 1) =>
      floating.push({
        kind,
        home,
        homeRot,
        away: home.clone().add(V((rand() - 0.5) * 1.6, (1 + rand() * 1.4) * lift, (rand() - 0.2) * 1.2)),
        awayRot: E(homeRot.x + (rand() - 0.5) * 1.4, homeRot.y + (rand() - 0.5) * 1.8, homeRot.z + (rand() - 0.5) * 1.4),
        scale,
        color: rand() > 0.45 ? ACCENTS[Math.floor(rand() * ACCENTS.length)] : STONE,
        phase: rand() * Math.PI * 2,
        order: rand(),
      });

    const archO = V(1.6, 0, -2.6);
    [-1, 1].forEach((s) => {
      built.push({ kind: "block", pos: V(archO.x + s, 0.1, archO.z), rot: E(0, 0, 0), scale: V(0.52, 0.2, 0.52) });
      built.push({ kind: "drum", pos: V(archO.x + s, 1.3, archO.z), rot: E(0, 0, 0), scale: V(0.34, 2.2, 0.34) });
      built.push({ kind: "block", pos: V(archO.x + s, 2.48, archO.z), rot: E(0, 0, 0), scale: V(0.48, 0.16, 0.48) });
    });
    for (let i = 0; i < 5; i++) {
      const rot = E(0, 0, (i * Math.PI) / 5);
      const pos = V(archO.x, 2.56, archO.z);
      if (i === 2 || i === 4) float("voussoir", pos, rot, V(1, 1, 1), 0.8);
      else built.push({ kind: "voussoir", pos, rot, scale: V(1, 1, 1) });
    }
    const wallO = V(-1.4, 0, -3.4);
    const missing = new Set(["3-1", "3-3", "2-4", "3-4", "2-0", "1-2"]);
    for (let row = 0; row < 4; row++)
      for (let c = 0; c < 5; c++) {
        const pos = local(wallO, 0.38, c * 0.62 - 1.24 + (row % 2 ? 0.31 : 0), 0.17 + row * 0.34, 0);
        const args = [pos, E(0, 0.38, 0), V(0.6, 0.32, 0.36)] as const;
        if (missing.has(`${row}-${c}`)) float("block", ...args);
        else built.push({ kind: "block", pos, rot: args[1], scale: args[2] });
      }
    const stairO = V(4.4, 0, 0.4);
    for (let i = 0; i < 7; i++) {
      const pos = local(stairO, -0.55, 0, 0.11 + i * 0.22, -i * 0.32);
      if (i >= 4) float("step", pos, E(0, -0.55, 0), V(1.1, 0.22, 0.34), 0.7);
      else built.push({ kind: "step", pos, rot: E(0, -0.55, 0), scale: V(1.1, 0.22, 0.34) });
    }
    const pavO = V(4.9, 0, -3.6);
    built.push({ kind: "slab", pos: V(pavO.x, 0.08, pavO.z), rot: E(0, 0.3, 0), scale: V(1.9, 0.16, 1.9) });
    for (const [x, z] of [
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ])
      built.push({ kind: "drum", pos: local(pavO, 0.3, x, 0.96, z), rot: E(0, 0, 0), scale: V(0.16, 1.6, 0.16) });
    float("slab", local(pavO, 0.3, 0, 1.82, 0), E(0, 0.3, 0), V(1.9, 0.12, 1.9), 0.6);
    float("roof", local(pavO, 0.3, 0, 2.28, 0), E(0, 0.3 + Math.PI / 4, 0), V(1.45, 0.8, 1.45), 0.6);
    const colO = V(-0.3, 0, 0.4);
    for (let i = 0; i < 4; i++) {
      const pos = V(colO.x, 0.28 + i * 0.52, colO.z);
      if (i >= 2) float("drum", pos, E(0, 0, 0), V(0.4, 0.5, 0.4), 0.9);
      else built.push({ kind: "drum", pos, rot: E(0, 0, 0), scale: V(0.4, 0.5, 0.4) });
    }
    return { built, floating };
  }, []);
}

function useGeometries() {
  const g = useMemo(() => {
    const block = new RoundedBoxGeometry(1, 1, 1, 2, 0.05);
    const drum = new THREE.CylinderGeometry(0.5, 0.5, 1, 22);
    const roof = new THREE.ConeGeometry(0.72, 1, 4).translate(0, 0.5, 0);
    const s = new THREE.Shape();
    const a0 = 0.012;
    const a1 = Math.PI / 5 - 0.012;
    s.absarc(0, 0, 1.16, a0, a1, false);
    s.lineTo(Math.cos(a1) * 0.82, Math.sin(a1) * 0.82);
    s.absarc(0, 0, 0.82, a1, a0, true);
    s.closePath();
    const voussoir = new THREE.ExtrudeGeometry(s, { depth: 0.44, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -0.22);
    return { block, step: block, slab: block, drum, roof, voussoir };
  }, []);
  useDisposable([g.block, g.drum, g.roof, g.voussoir]);
  return g;
}

export default function UnfinishedWorld() {
    const plan = usePlan();
  const geos = useGeometries();
  const stone = useMemo(() => toon(STONE), []);
  const ghost = useMemo(() => new THREE.MeshBasicMaterial({ color: "#E3B65A", transparent: true, opacity: 0.18, depthWrite: false }), []);
  const accents = useMemo(() => Object.fromEntries([...ACCENTS, STONE].map((c) => [c, toon(c)])), []);
  useDisposable([stone, ghost, ...Object.values(accents)]);
  const pieces = useRef<(THREE.Mesh | null)[]>([]);
  const ghosts = useRef<(THREE.Mesh | null)[]>([]);
  const lines = useRef<THREE.LineSegments>(null);
  const st = useRef({ t: plan.floating.map(() => 0), target: plan.floating.map(() => 0), cx: 0, cy: 0, v: new THREE.Vector3(), q0: new THREE.Quaternion(), q1: new THREE.Quaternion() });
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(plan.floating.length * 6), 3));
    return g;
  }, [plan]);
  useDisposable([lineGeo]);

  useActiveFrame(IDX, 34, 100, (frame, dt) => {
    const s = st.current;
    const calm = getShared().reducedMotion;
    const p = live.smooth[IDX];
    const now = performance.now() / 1000;
    const cam = frame.camera;

    // emerge from the arch's white light, then settle
    const settle = smoothstep(0, 0.3, p);
    s.cx = damp(s.cx, calm ? 0 : live.pointerX * 0.45, 2.2, dt);
    s.cy = damp(s.cy, calm ? 0 : live.pointerY * 0.2, 2.2, dt);
    const mobile = frame.size.width < 768;
    cam.position.set(1.6 + s.cx, THREE.MathUtils.lerp(2.2, mobile ? 5.2 : 4.4, settle) + s.cy, THREE.MathUtils.lerp(3, mobile ? 22 : 17.5, settle));
    cam.lookAt(1.4, THREE.MathUtils.lerp(1.6, mobile ? 0.6 : 1.3, settle), -1.6);
    cam.updateMatrixWorld();

    const pulseAge = now - live.pulseAt;
    const pulse = pulseAge < 3 ? 1 - smoothstep(1.2, 3, pulseAge) : 0;
    const pos = lines.current!.geometry.attributes.position as THREE.BufferAttribute;
    plan.floating.forEach((pc, i) => {
      s.v.copy(pc.away).project(cam);
      const pull = Math.max(
        live.pointerActive ? 1 - smoothstep(0.12, 0.42, Math.hypot(s.v.x - live.pointerX, s.v.y - live.pointerY)) : 0,
        pulse * (1 - smoothstep(0.2, 0.7, Math.hypot(s.v.x - live.pulseX, s.v.y - live.pulseY))),
        // scrolling to the very end builds the world, piece by piece
        smoothstep(0.55 + pc.order * 0.3, 0.7 + pc.order * 0.3, p),
      );
      s.target[i] = Math.max(pull, s.target[i] - dt * 0.12);
      s.t[i] = damp(s.t[i], s.target[i], pull > s.t[i] ? 3.4 : 1.2, dt);
      const k = s.t[i] * s.t[i] * (3 - 2 * s.t[i]);
      const m = pieces.current[i];
      if (!m) return;
      m.position.lerpVectors(pc.away, pc.home, k);
      m.position.y += calm ? 0 : Math.sin(frame.clock.elapsedTime * 0.8 + pc.phase) * 0.06 * (1 - k);
      s.q0.setFromEuler(pc.awayRot);
      s.q1.setFromEuler(pc.homeRot);
      m.quaternion.slerpQuaternions(s.q0, s.q1, k);
      const g = ghosts.current[i];
      if (g) g.visible = k < 0.98;
      pos.setXYZ(i * 2, m.position.x, m.position.y, m.position.z);
      pos.setXYZ(i * 2 + 1, pc.home.x, pc.home.y, pc.home.z);
    });
    pos.needsUpdate = true;
    lines.current!.computeLineDistances();
  });

  return (
    <>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[200, 200]} />
        <meshToonMaterial color="#ECE6DA" />
      </mesh>
      <gridHelper ref={fxLayer} args={[10, 10, "#D9C9A8", "#E3D7BF"]} position={[1.8, 0.004, -1.8]} />

      {plan.built.map((b, i) => (
        <mesh key={i} geometry={geos[b.kind]} material={stone} position={b.pos} rotation={b.rot} scale={b.scale} />
      ))}
      {plan.floating.map((pc, i) => (
        <group key={i}>
          <mesh ref={(el) => void (pieces.current[i] = el)} geometry={geos[pc.kind]} material={accents[pc.color]} scale={pc.scale} position={pc.away} rotation={pc.awayRot} />
          <mesh
            ref={(el) => {
              ghosts.current[i] = el;
              fxLayer(el);
            }}
            geometry={geos[pc.kind]}
            material={ghost}
            position={pc.home}
            rotation={pc.homeRot}
            scale={pc.scale}
          />
        </group>
      ))}
      <lineSegments ref={(el) => { lines.current = el; fxLayer(el); }} geometry={lineGeo} frustumCulled={false}>
        <lineDashedMaterial color="#B98A2E" dashSize={0.08} gapSize={0.07} />
      </lineSegments>
      <BakedShadow shape="rect" position={[1.6, 0.005, -2.6]} size={[3, 0.9]} opacity={0.22} />
      <BakedShadow shape="rect" position={[-1.4, 0.005, -3.4]} size={[3.4, 0.9]} rotation={-0.38} opacity={0.2} />
      <BakedShadow position={[4.9, 0.005, -3.6]} size={[2.8, 2.8]} opacity={0.2} />
    </>
  );
}
