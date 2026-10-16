"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import * as THREE from "three";
import { CHAPTERS, type ChapterId } from "@/lib/chapters";
import { getShared, live, setShared, stageApi, useShared } from "@/lib/experience";
import { InkRenderer } from "./ink";

type Loader = () => Promise<{ default: ComponentType }>;

/** one module per world, so each is its own chunk */
const loaders: Record<ChapterId, Loader> = {
  door: () => import("./worlds/DoorWorld"),
  blueprint: () => import("./worlds/BlueprintWorld"),
  city: () => import("./worlds/CityWorld"),
  reef: () => import("./worlds/ReefWorld"),
  observatory: () => import("./worlds/ObservatoryWorld"),
  gallery: () => import("./worlds/GalleryWorld"),
  unfinished: () => import("./worlds/UnfinishedWorld"),
};

/** the one shared light rig; the reef dims it and lights its lantern */
export const rig: { ambient: THREE.AmbientLight | null; sun: THREE.DirectionalLight | null; lamp: THREE.PointLight | null } = {
  ambient: null,
  sun: null,
  lamp: null,
};

/** world groups, so the warm-up can show each one in turn */
const slots: (THREE.Group | null)[] = [];

/** every world stays mounted; only the active chapter's world is visible */
function WorldSlot({ index, children }: { index: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    slots[index] = group.current;
    return () => void (slots[index] = null);
  }, [index]);
  useFrame(() => {
    if (!live.warming && group.current) group.current.visible = getShared().chapter === index;
  }, -1);
  return (
    <group ref={group} visible={index === 0}>
      {children}
    </group>
  );
}

/** background, fog and the single shared light rig follow the active chapter */
function Atmosphere() {
  const chapter = useShared((s) => s.chapter);
  const get = useThree((s) => s.get);
  const ambient = useRef<THREE.AmbientLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  useEffect(() => {
    rig.ambient = ambient.current;
    rig.sun = sun.current;
    rig.lamp = lamp.current;
  }, []);
  useEffect(() => {
    const c = CHAPTERS[chapter];
    live.night = 0;
    if (lamp.current) lamp.current.intensity = 0;
    const { scene, gl } = get();
    scene.background = new THREE.Color(c.bg);
    scene.fog = new THREE.Fog(c.bg, c.fog[0], c.fog[1]);
    gl.setClearColor(c.bg);
    if (ambient.current) ambient.current.intensity = c.light.ambient;
    if (sun.current) {
      sun.current.intensity = c.light.sun;
      sun.current.position.set(...c.light.pos);
    }
  }, [chapter, get]);
  return (
    <>
      <ambientLight ref={ambient} intensity={CHAPTERS[0].light.ambient} />
      <directionalLight ref={sun} intensity={CHAPTERS[0].light.sun} position={CHAPTERS[0].light.pos} />
      {/* always present (intensity 0 elsewhere) so light counts never change between worlds */}
      <pointLight ref={lamp} intensity={0} distance={10} decay={1.4} color="#FFC46B" />
    </>
  );
}

/**
 * Behind the opening door: compile every shader in parallel, then render each
 * world once (frustum culling off) so all geometry and textures are uploaded
 * to the GPU. After this, no world ever loads or compiles mid-flight.
 */
function Warmup() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    let alive = true;
    setShared({ compiling: true });
    const { gl, scene, camera } = get();
    live.warming = true;
    slots.forEach((g) => g && (g.visible = true));
    const culled: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.frustumCulled) {
        o.frustumCulled = false;
        culled.push(o);
      }
    });
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    (async () => {
      await gl.compileAsync(scene, camera).catch(() => undefined);
      setShared({ warmSteps: 1 });
      for (let i = 0; i < slots.length && alive; i++) {
        slots.forEach((g, k) => g && (g.visible = k === i));
        gl.render(scene, camera);
        await frame();
        setShared({ warmSteps: 2 + i });
      }
      culled.forEach((o) => (o.frustumCulled = true));
      live.warming = false;
      slots.forEach((g, k) => g && (g.visible = k === getShared().chapter));
      if (!alive) return;
      setShared({ compiling: false, warmed: true });
    })();
    return () => {
      alive = false;
    };
  }, [get]);
  return null;
}

export default function Stage() {
  const quality = useShared((s) => s.quality);
  const compiling = useShared((s) => s.compiling);
  const chapter = useShared((s) => s.chapter);
  const [visible, setVisible] = useState(true);
  const max = quality === "high" ? 1.5 : 1;
  const [dpr, setDpr] = useState(max);
  const [worlds, setWorlds] = useState<ComponentType[] | null>(null);

  useEffect(() => {
    setShared({ stageLoaded: true });
    let built = 0;
    // fetch every world up front; count them honestly as they arrive
    Promise.all(
      CHAPTERS.map((c) =>
        loaders[c.id]().then((m) => {
          setShared({ worldsBuilt: ++built });
          return m.default;
        }),
      ),
    ).then(setWorlds);
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0">
      {worlds && (
        <Canvas
          flat
          dpr={[1, dpr]}
          frameloop={!visible || compiling ? "never" : "always"}
          camera={{ fov: 35, near: 0.05, far: 160, position: [0, 1.5, 8] }}
          style={{ touchAction: "pan-y" }}
          gl={{ antialias: false, alpha: false, powerPreference: "high-performance", stencil: false }}
          onCreated={({ gl, invalidate }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.setClearColor(CHAPTERS[0].bg);
            gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
            stageApi.invalidate = () => invalidate();
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setShared({ webgl: false });
            });
          }}
        >
          <PerformanceMonitor
            onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
            onIncline={() => setDpr((d) => Math.min(max, d + 0.25))}
          />
          <InkRenderer ink={CHAPTERS[chapter].ink} scale={quality === "high" ? 1 : 0.85} />
          <Atmosphere />
          {worlds.map((W, i) => (
            <WorldSlot key={CHAPTERS[i].id} index={i}>
              <W />
            </WorldSlot>
          ))}
          <Warmup />
        </Canvas>
      )}
    </div>
  );
}
