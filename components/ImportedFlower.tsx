"use client";

import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import units from "../public/models/units.json";

export const IMPORTED_FLOWERS: Record<string, string> = {
  ivy: "/models/ivy.glb",
  rose: "/models/garden-rose.glb",
  gerbera: "/models/gerbera.glb",
  chamomile: "/models/chamomile.glb",
  anemone: "/models/anemone.glb",
  lily: "/models/lily.glb",
  orchid: "/models/orchid.glb",
  sunflower: "/models/sunflower.glb",
  tulip: "/models/tulip.glb",
  daisy: "/models/daisy.glb",
  poppy: "/models/poppy.glb",
  peony: "/models/peony.glb",
  hydrangea: "/models/hydrangea.glb",
  "blue-poppy": "/models/poppy.glb",
};

export const IMPORTED_STEMS: Record<string, string> = {
  chrysanthemum: "/models/chrysanthemum.glb",
  "lily-of-the-valley": "/models/lily-of-the-valley.glb",
  fern: "/models/fern.glb",
  eucalyptus: "/models/eucalyptus.glb",
  "seeded-eucalyptus": "/models/eucalyptus-sprig.glb",
  // New additions
  "calla-lily": "/models/calla-lily.glb",
  carnation: "/models/carnation.glb",
  lotus: "/models/lotus.glb",
  delphinium: "/models/delphinium.glb",
  snowdrop: "/models/snowdrop.glb",
  lavender: "/models/lavender.glb",
  monstera: "/models/monstera.glb",
};

// Assets are baked in Y-up coordinates with their cut end at the origin.
const assetVersion = "single-unit-v1";
export function flowerHeadHeight(kind: string) {
  const filename = IMPORTED_FLOWERS[kind]?.split("/").pop()?.replace(".glb", "");
  return filename ? (units as Record<string, { height: number }>)[filename]?.height ?? 0 : 0;
}

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function addPetalTint(material: THREE.Material, bloomColor?: string) {
  if (!bloomColor || !(material instanceof THREE.MeshStandardMaterial)) return;
  const tint = new THREE.Color(bloomColor);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.bloomPetalColor = { value: tint };
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nuniform vec3 bloomPetalColor;",
    ).replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec3 bloomSource = diffuseColor.rgb;
      float bloomLuminance = dot(bloomSource, vec3(0.299, 0.587, 0.114));
      float bloomGreenMask = smoothstep(0.015, 0.12, bloomSource.g - bloomSource.r);
      float bloomPetalMask = (1.0 - bloomGreenMask) * smoothstep(0.025, 0.12, bloomLuminance);
      vec3 bloomRecolored = bloomPetalColor * clamp(0.45 + bloomLuminance * 1.35, 0.38, 1.45);
      diffuseColor.rgb = mix(bloomSource, min(bloomRecolored, vec3(1.0)), bloomPetalMask * 0.88);`,
    );
  };
  material.customProgramCacheKey = () => `bloom-petal-tint-${bloomColor}`;
  material.needsUpdate = true;
}

function LoadedModel({ kind, ghost, bloomColor, height = 1, head = false }: { kind: string; ghost: boolean; bloomColor?: string; height?: number; head?: boolean }) {
  const url = (head ? IMPORTED_FLOWERS : IMPORTED_STEMS)[kind];
  const { scene } = useGLTF(`${url}?v=${assetVersion}`);
  const { object, materials } = useMemo(() => {
    const object = scene.clone(true);
    const materials: THREE.Material[] = [];
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = !ghost;
      child.receiveShadow = true;
      const prepare = (source: THREE.Material) => {
        const material = source.clone();
        if (material instanceof THREE.MeshStandardMaterial) {
          material.metalness = 0;
          material.roughness = Math.max(0.68, material.roughness);
        }
        addPetalTint(material, bloomColor);
        if (ghost) { material.transparent = true; material.opacity = 0.4; material.depthWrite = false; }
        materials.push(material);
        return material;
      };
      child.material = Array.isArray(child.material) ? child.material.map(prepare) : prepare(child.material);
    });
    return { object, materials };
  }, [scene, ghost, bloomColor]);
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  return <group scale={head ? 1 : height}><primitive object={object} dispose={null} /></group>;
}

export function ImportedFlower({ kind, ghost, bloomColor, fallback }: { kind: string; ghost: boolean; bloomColor?: string; fallback: ReactNode }) {
  return <ModelBoundary fallback={fallback}>
    <Suspense fallback={fallback}><LoadedModel head kind={kind} ghost={ghost} bloomColor={bloomColor} /></Suspense>
  </ModelBoundary>;
}

export function ImportedStem({ kind, ghost = false, height, bloomColor, fallback }: { kind: string; ghost?: boolean; height: number; bloomColor?: string; fallback: ReactNode }) {
  return <ModelBoundary fallback={fallback}>
    <Suspense fallback={fallback}><LoadedModel kind={kind} ghost={ghost} height={height} bloomColor={bloomColor} /></Suspense>
  </ModelBoundary>;
}
