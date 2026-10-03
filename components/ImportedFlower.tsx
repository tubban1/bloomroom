"use client";

import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import units from "../public/models/units.json";
import { resizeStemGeometry, stemCutAnchor } from "../lib/stem-geometry";

export const IMPORTED_FLOWERS: Record<string, string> = {
  rose: "/models/garden-rose.glb",
  carnation: "/models/carnation.glb",
  "ranunculus": "/models/ranunculus.glb",
  "narcissus": "/models/narcissus.glb",
  "dahlia": "/models/dahlia.glb",
  "astrantia": "/models/astrantia.glb",
  "eryngium": "/models/eryngium.glb",
  "pine-cone": "/models/pine-cone.glb",

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
  ivy: "/models/ivy.glb",
  amaryllis: "/models/amaryllis.glb",
  chrysanthemum: "/models/chrysanthemum.glb",
  "lily-of-the-valley": "/models/lily-of-the-valley.glb",
  fern: "/models/fern.glb",
  eucalyptus: "/models/eucalyptus.glb",
  "seeded-eucalyptus": "/models/eucalyptus-sprig.glb",
  // New additions
  "calla-lily": "/models/calla-lily.glb",
  lotus: "/models/lotus.glb",
  delphinium: "/models/delphinium.glb",
  snowdrop: "/models/snowdrop.glb",
  lavender: "/models/lavender.glb",
  monstera: "/models/monstera.glb",
};

// Assets are baked in Y-up coordinates with their cut end at the origin.
const assetVersion = "swiss-cut-units-v12";
export function flowerHeadHeight(kind: string) {
  const filename = IMPORTED_FLOWERS[kind]?.split("/").pop()?.replace(".glb", "");
  return filename ? (units as Record<string, { height: number }>)[filename]?.height ?? 0 : 0;
}

export function flowerHeadWidth(kind: string) {
  const filename = IMPORTED_FLOWERS[kind]?.split("/").pop()?.replace(".glb", "");
  return filename ? (units as Record<string, { width: number }>)[filename]?.width ?? 0 : 0;
}

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function addPetalTint(material: THREE.Material, bloomColor?: string, kind?: string) {
  if (!bloomColor || !(material instanceof THREE.MeshStandardMaterial)) return;
  const tint = new THREE.Color(bloomColor);
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
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
      float bloomYellowMask = smoothstep(0.1, 0.24, bloomSource.r - bloomSource.b) * smoothstep(0.1, 0.22, bloomSource.g - bloomSource.b);
      // Lotus pollen/receptacle retain their scan color in every petal variant.
      // Relative chroma also identifies gold in shadow, where absolute RGB is low.
      float lotusGoldChroma = (min(bloomSource.r, bloomSource.g) - bloomSource.b) / max(max(bloomSource.r, bloomSource.g), 0.001);
      float lotusGoldMask = smoothstep(0.22, 0.46, lotusGoldChroma);
      float bloomPetalMask = (1.0 - bloomGreenMask) * ${kind === "anemone" ? "(1.0 - bloomYellowMask) * smoothstep(0.58, 0.82, bloomLuminance)" : kind === "lotus" ? "(1.0 - lotusGoldMask) * smoothstep(0.025, 0.12, bloomLuminance)" : "smoothstep(0.025, 0.12, bloomLuminance)"};
      vec3 bloomRecolored = bloomPetalColor * clamp(0.45 + bloomLuminance * 1.35, 0.38, 1.45);
      diffuseColor.rgb = mix(bloomSource, min(bloomRecolored, vec3(1.0)), bloomPetalMask * 0.88);`,
    );
  };
  material.customProgramCacheKey = () => `${previousKey()}-bloom-petal-tint-v2-${kind}-${bloomColor}`;
  material.needsUpdate = true;
}

function LoadedModel({ kind, ghost, bloomColor, height = 1, visualScale = 1, head = false }: { kind: string; ghost: boolean; bloomColor?: string; height?: number; visualScale?: number; head?: boolean }) {
  const url = (head ? IMPORTED_FLOWERS : IMPORTED_STEMS)[kind];
  const { scene } = useGLTF(`${url}?v=${kind === "carnation" ? "carnation-natural-v13" : assetVersion}`);
  const { object, materials, geometries } = useMemo(() => {
    const object = scene.clone(true);
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    const sources: THREE.BufferGeometry[] = [];
    object.traverse((child) => { if (child instanceof THREE.Mesh) sources.push(child.geometry); });
    const anchor = head ? new THREE.Vector2() : stemCutAnchor(sources, height, visualScale);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!head) {
        child.geometry = resizeStemGeometry(child.geometry, height, visualScale, anchor);
        geometries.push(child.geometry);
      }
      child.castShadow = !ghost;
      child.receiveShadow = true;
      const prepare = (source: THREE.Material) => {
        const material = source.clone();
        if (material instanceof THREE.MeshStandardMaterial) {
          material.metalness = 0;
          material.roughness = Math.max(0.68, material.roughness);
        }
        if (kind === "lily" && material instanceof THREE.MeshStandardMaterial) {
          const previousCompile = material.onBeforeCompile.bind(material);
          material.onBeforeCompile = (shader, renderer) => {
            previousCompile(shader, renderer);
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <color_fragment>",
              `#include <color_fragment>
              float botanicalLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
              diffuseColor.rgb = mix(vec3(botanicalLuma), diffuseColor.rgb, 0.54) * 0.9;`,
            );
          };
          material.customProgramCacheKey = () => "natural-lily-v1";
        }
        addPetalTint(material, bloomColor, kind);
        if (ghost) { material.transparent = true; material.opacity = 0.4; material.depthWrite = false; }
        materials.push(material);
        return material;
      };
      child.material = Array.isArray(child.material) ? child.material.map(prepare) : prepare(child.material);
    });
    return { object, materials, geometries };
  }, [scene, ghost, bloomColor, kind, head, height, visualScale]);
  useEffect(() => () => {
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
  }, [materials, geometries]);
  return <primitive object={object} dispose={null} />;
}

export function ImportedFlower({ kind, ghost, bloomColor, fallback }: { kind: string; ghost: boolean; bloomColor?: string; fallback: ReactNode }) {
  return <ModelBoundary fallback={fallback}>
    <Suspense fallback={fallback}><LoadedModel head kind={kind} ghost={ghost} bloomColor={bloomColor} /></Suspense>
  </ModelBoundary>;
}

export function ImportedStem({ kind, ghost = false, height, visualScale = 1, bloomColor, fallback }: { kind: string; ghost?: boolean; height: number; visualScale?: number; bloomColor?: string; fallback: ReactNode }) {
  return <ModelBoundary fallback={fallback}>
    <Suspense fallback={fallback}><LoadedModel kind={kind} ghost={ghost} height={height} visualScale={visualScale} bloomColor={bloomColor} /></Suspense>
  </ModelBoundary>;
}
