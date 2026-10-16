"use client";

import { useFrame, type RootState } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getShared, live } from "@/lib/experience";
import { fxLayer } from "./ink";

export { rng } from "@/lib/random";

/**
 * A world's per-frame logic, run only while its chapter is the active one
 * (all worlds stay mounted; only the active one is visible). Also applies
 * the world's lens — portrait screens get a wider one so compositions fit.
 */
export function useActiveFrame(index: number, fov: number, far: number, cb: (state: RootState, dt: number) => void) {
  useFrame((state, delta) => {
    if (getShared().chapter !== index) return;
    const cam = state.camera as THREE.PerspectiveCamera;
    const aspect = state.size.width / state.size.height;
    const want = aspect < 1 ? Math.min(78, fov * (1 + (1 - aspect) * 1.25)) : fov;
    if (Math.abs(cam.fov - want) > 0.01 || cam.far !== far) {
      cam.fov = want;
      cam.far = far;
      cam.near = 0.05;
      cam.updateProjectionMatrix();
    }
    cb(state, Math.min(delta, 0.05));
  });
}

type V3 = [number, number, number];

/** a camera move: position and look-at splines sampled by progress */
export function useFlight(pos: V3[], look: V3[]) {
  return useMemo(
    () => ({
      pos: new THREE.CatmullRomCurve3(pos.map((p) => new THREE.Vector3(...p)), false, "centripetal"),
      look: new THREE.CatmullRomCurve3(look.map((p) => new THREE.Vector3(...p)), false, "centripetal"),
      tmp: new THREE.Vector3(),
    }),
    // the paths are literals defined per world; they never change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

export function fly(cam: THREE.Camera, flight: ReturnType<typeof useFlight>, p: number, offset?: THREE.Vector3) {
  const t = Math.min(1, Math.max(0, p));
  flight.pos.getPointAt(t, cam.position);
  if (offset) cam.position.add(offset);
  flight.look.getPointAt(t, flight.tmp);
  cam.lookAt(flight.tmp);
}

const projected = new THREE.Vector3();
/** write the screen position (CSS px) of a world point for a DOM label */
export function writeAnchor(name: string, world: THREE.Vector3, camera: THREE.Camera, size: { width: number; height: number }) {
  projected.copy(world).project(camera);
  const visible = projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
  const a = live.anchors.get(name) ?? { x: 0, y: 0, visible: false };
  a.x = ((projected.x + 1) / 2) * size.width;
  a.y = ((1 - projected.y) / 2) * size.height;
  a.visible = visible;
  live.anchors.set(name, a);
}

/** clear anchors a world owned when it unmounts */
export function useAnchorCleanup(names: string[]) {
  useEffect(
    () => () => names.forEach((n) => live.anchors.delete(n)),
    // names are static per world
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

/** radial or rectangular soft gradient as a texture; disposed with the caller */
export function useGlowTexture(kind: "radial" | "halo") {
  const tex = useMemo(() => {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    if (kind === "radial") {
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.5, "rgba(255,255,255,0.4)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, size, size);
    } else {
      g.filter = "blur(26px)";
      g.fillStyle = "white";
      g.beginPath();
      g.roundRect(70, 40, 116, 176, 30);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [kind]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** baked contact shadow: pre-blurred texture on a plane, no ink line */
export function BakedShadow({
  position,
  size,
  rotation = 0,
  opacity = 0.25,
  shape = "radial",
  color = "#2a2018",
}: {
  position: V3;
  size: [number, number];
  rotation?: number;
  opacity?: number;
  shape?: "radial" | "rect";
  color?: string;
}) {
  const tex = useGlowTexture(shape === "rect" ? "halo" : "radial");
  return (
    <mesh ref={fxLayer} position={position} rotation={[-Math.PI / 2, 0, rotation]} renderOrder={-1}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={tex} color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** dispose imperatively created geometries/materials on unmount */
export function useDisposable<T extends { dispose: () => void }>(items: T[]) {
  useEffect(() => () => items.forEach((i) => i.dispose()), [items]);
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
