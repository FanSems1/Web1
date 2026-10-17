"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getShared, live } from "@/lib/experience";

const GLOW_INK = new THREE.Color("#FFD9FF");

/** objects on this layer render in colour but never get ink lines (sky, glows, shadows) */
export const FX_LAYER = 2;

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/**
 * Hand-drawn look in one pass:
 * - ink lines from Sobel edges of view normals + linear depth
 * - lines fade with distance, like the scene fog
 * - "line boil": sampling jitters on a stepped 8 fps clock, like redrawn frames
 * - paper grain multiplied over everything
 */
const frag = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uTime;
uniform float uNear;
uniform float uFar;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uInk;
uniform float uBoil;
uniform float uLine;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float linDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  float frame = floor(uTime * 8.0);
  vec2 wob = (vec2(noise(vUv * 6.0 + frame * 1.7), noise(vUv * 6.0 + frame * 1.7 + 19.0)) - 0.5) * (1.8 * uBoil) / uRes;
  vec2 uv = vUv + wob;
  vec2 px = uLine / uRes;

  vec3 n00 = texture2D(tNormal, uv + px * vec2(-1.0, -1.0)).rgb;
  vec3 n10 = texture2D(tNormal, uv + px * vec2( 0.0, -1.0)).rgb;
  vec3 n20 = texture2D(tNormal, uv + px * vec2( 1.0, -1.0)).rgb;
  vec3 n01 = texture2D(tNormal, uv + px * vec2(-1.0,  0.0)).rgb;
  vec3 n21 = texture2D(tNormal, uv + px * vec2( 1.0,  0.0)).rgb;
  vec3 n02 = texture2D(tNormal, uv + px * vec2(-1.0,  1.0)).rgb;
  vec3 n12 = texture2D(tNormal, uv + px * vec2( 0.0,  1.0)).rgb;
  vec3 n22 = texture2D(tNormal, uv + px * vec2( 1.0,  1.0)).rgb;
  vec3 gxN = (n20 + 2.0 * n21 + n22) - (n00 + 2.0 * n01 + n02);
  vec3 gyN = (n02 + 2.0 * n12 + n22) - (n00 + 2.0 * n10 + n20);
  float eN = length(gxN) + length(gyN);

  float dc = linDepth(uv);
  float d00 = linDepth(uv + px * vec2(-1.0, -1.0));
  float d10 = linDepth(uv + px * vec2( 0.0, -1.0));
  float d20 = linDepth(uv + px * vec2( 1.0, -1.0));
  float d01 = linDepth(uv + px * vec2(-1.0,  0.0));
  float d21 = linDepth(uv + px * vec2( 1.0,  0.0));
  float d02 = linDepth(uv + px * vec2(-1.0,  1.0));
  float d12 = linDepth(uv + px * vec2( 0.0,  1.0));
  float d22 = linDepth(uv + px * vec2( 1.0,  1.0));
  float gxD = (d20 + 2.0 * d21 + d22) - (d00 + 2.0 * d01 + d02);
  float gyD = (d02 + 2.0 * d12 + d22) - (d00 + 2.0 * d10 + d20);
  float eD = (abs(gxD) + abs(gyD)) / max(dc, 0.001);

  float edge = max(smoothstep(0.55, 1.05, eN), smoothstep(0.09, 0.22, eD));
  // pencil pressure varies a little along the line
  edge *= 0.78 + 0.22 * noise(vUv * uRes / 14.0 + frame * uBoil);
  edge *= 1.0 - smoothstep(uFogNear, uFogFar, dc) * 0.9;

  vec4 base = texture2D(tColor, vUv);
  vec3 col = base.rgb;
  float grain = noise(vUv * uRes / 1.6) * 0.55 + noise(vUv * uRes / 7.0) * 0.45;
  col *= 0.93 + 0.07 * grain;
  col = mix(col, uInk, clamp(edge, 0.0, 1.0) * 0.9);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * Takes over R3F's render loop (priority 1): colour+depth → normals → composite.
 * Two scene passes; the normal pass skips FX_LAYER objects.
 */
function createTargets() {
  const color = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  color.texture.colorSpace = THREE.SRGBColorSpace;
  color.depthTexture = new THREE.DepthTexture(1, 1);
  color.depthTexture.type = THREE.UnsignedIntType;
  const normal = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  const normalMat = new THREE.MeshNormalMaterial();
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: color.texture },
      tNormal: { value: normal.texture },
      tDepth: { value: color.depthTexture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFogNear: { value: 20 },
      uFogFar: { value: 60 },
      uInk: { value: new THREE.Color() },
      uBoil: { value: 1 },
      uLine: { value: 1 },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  quadScene.add(quad);
  return {
    color,
    normal,
    normalMat,
    quadScene,
    quadCam,
    mat,
    w: 0,
    h: 0,
    clear: new THREE.Color(),
    dispose() {
      color.depthTexture?.dispose();
      color.dispose();
      normal.dispose();
      normalMat.dispose();
      mat.dispose();
      quad.geometry.dispose();
    },
  };
}

/**
 * Takes over R3F's render loop (priority 1): colour+depth → normals → composite.
 * Two scene passes; the normal pass skips FX_LAYER objects.
 */
export function InkRenderer({ ink = "#1D2624", scale = 1 }: { ink?: string; scale?: number }) {
  const targets = useRef<ReturnType<typeof createTargets> | null>(null);
  useEffect(
    () => () => {
      targets.current?.dispose();
      targets.current = null;
    },
    [],
  );

  useFrame((state) => {
    const { gl, scene, camera, size, viewport } = state;
    const res = (targets.current ??= createTargets());
    const w = Math.max(1, Math.floor(size.width * viewport.dpr * scale));
    const h = Math.max(1, Math.floor(size.height * viewport.dpr * scale));
    const u = res.mat.uniforms;
    if (w !== res.w || h !== res.h) {
      res.w = w;
      res.h = h;
      res.color.setSize(w, h);
      res.normal.setSize(w, h);
      u.uRes.value.set(w, h);
      // keep the line roughly 1.35 CSS px wide regardless of DPR
      u.uLine.value = Math.max(1, viewport.dpr * scale * 1.35);
    }
    // while the crystals resonate the ink turns to glowing light lines
    u.uInk.value.set(ink).lerp(GLOW_INK, live.glow);
    const cam = camera as THREE.PerspectiveCamera;
    u.uNear.value = cam.near;
    u.uFar.value = cam.far;
    const fog = scene.fog as THREE.Fog | null;
    u.uFogNear.value = fog ? fog.near : 1e4;
    u.uFogFar.value = fog ? fog.far : 2e4;
    const calm = getShared().reducedMotion;
    u.uTime.value = calm ? 0 : state.clock.elapsedTime;
    u.uBoil.value = calm ? 0 : 1;

    camera.layers.enable(FX_LAYER);
    gl.setRenderTarget(res.color);
    gl.render(scene, camera);

    // normals: neutral clear colour so the background never produces edges
    const bg = scene.background;
    const prevClear = gl.getClearColor(res.clear).getHex();
    const prevAlpha = gl.getClearAlpha();
    scene.background = null;
    scene.overrideMaterial = res.normalMat;
    camera.layers.disable(FX_LAYER);
    gl.setClearColor(0x7f7fff, 1);
    gl.setRenderTarget(res.normal);
    gl.clear();
    // matrices were already updated by the colour pass this frame
    const auto = scene.matrixWorldAutoUpdate;
    scene.matrixWorldAutoUpdate = false;
    gl.render(scene, camera);
    scene.matrixWorldAutoUpdate = auto;
    scene.overrideMaterial = null;
    scene.background = bg;
    camera.layers.enable(FX_LAYER);
    gl.setClearColor(prevClear, prevAlpha);

    gl.setRenderTarget(null);
    gl.render(res.quadScene, res.quadCam);
  }, 1);

  return null;
}

/* ------------------------------------------------------------------ */
/* cel-shaded materials                                                */
/* ------------------------------------------------------------------ */

let gradient: THREE.DataTexture | null = null;
function gradientMap() {
  if (gradient) return gradient;
  // three flat bands: shade, mid, lit
  const data = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

/** a flat cel-shaded material; caller owns disposal */
export function toon(color: THREE.ColorRepresentation, opts: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts });
}

/** put an object (and children) on the FX layer only */
export function fxLayer(o: THREE.Object3D | null) {
  o?.traverse((c) => c.layers.set(FX_LAYER));
}
