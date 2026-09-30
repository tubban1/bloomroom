"use client";

import {
  Canvas,
  ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { ContactShadows, OrthographicCamera, useProgress } from "@react-three/drei";
import {
  Check,
  Copy,
  Download,
  RotateCcw,
  Undo2,
  Redo2,
  Sparkles,
  Wind,
  X,
} from "lucide-react";
import {
  useEffectEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { ImportedFlower, ImportedStem, IMPORTED_STEMS, flowerHeadHeight } from "./ImportedFlower";
import { AmbientSoundPanel } from "./AmbientSound";

type Availability = "available" | "preorder" | "play";
type FlowerCategory = "main" | "filler" | "foliage";
type LibraryMode = "flowers" | "vessels";
type VesselKind = "classic" | "bud" | "bowl" | "footed" | "mug" | "paper" | "canvas" | "naked";
type FlowerKind =
  | "rose"
  | "tulip"
  | "daisy"
  | "poppy"
  | "peony"
  | "blue-poppy"
  | "eucalyptus"
  | "gerbera"
  | "chrysanthemum"
  | "hydrangea"
  | "lily-of-the-valley"
  | "fern"
  | "seeded-eucalyptus"
  // New additions
  | "sunflower"
  | "orchid"
  | "calla-lily"
  | "carnation"
  | "lily"
  | "lotus"
  | "anemone"
  | "chamomile"
  | "delphinium"
  | "snowdrop"
  | "lavender"
  | "ivy"
  | "monstera";

type FlowerSpec = {
  kind: FlowerKind;
  name: string;
  latin: string;
  color: string;
  center: string;
  category: FlowerCategory;
  availability: Availability;
  note: string;
};

type FlowerColorOption = { id: string; label: string; color: string; center?: string };

type Stem = {
  id: string;
  kind: FlowerKind;
  x: number;
  z: number;
  height: number;
  leanX: number;
  leanZ: number;
  seed: number;
  colorVariant?: string;
};

type BouquetRotation = { x: number; y: number; z: number };
type StudioSnapshot = {
  stems: Stem[];
  rotation: BouquetRotation;
  vessel: VesselKind;
  vesselColor: string;
  vesselOpacity: number;
};

const DEFAULT_BOUQUET_ROTATION: BouquetRotation = { x: 0, y: 0, z: 0 };

const FLOWERS: FlowerSpec[] = [
  {
    kind: "rose",
    name: "Garden rose",
    latin: "Rosa",
    color: "#c76577",
    center: "#7d2632",
    category: "main",
    availability: "available",
    note: "Soft, romantic volume",
  },
  {
    kind: "tulip",
    name: "Tulip",
    latin: "Tulipa",
    color: "#e8c5be",
    center: "#b98e85",
    category: "main",
    availability: "available",
    note: "Clean, quiet line",
  },
  {
    kind: "daisy",
    name: "Daisy",
    latin: "Bellis",
    color: "#f3eee2",
    center: "#c7a24a",
    category: "filler",
    availability: "available",
    note: "Tiny points of light",
  },
  {
    kind: "poppy",
    name: "Poppy",
    latin: "Papaver",
    color: "#df7358",
    center: "#4b3b35",
    category: "main",
    availability: "available",
    note: "Movement and air",
  },
  {
    kind: "peony",
    name: "Peony",
    latin: "Paeonia",
    color: "#d89aae",
    center: "#a85d78",
    category: "main",
    availability: "preorder",
    note: "Seasonal · preorder",
  },
  {
    kind: "blue-poppy",
    name: "Blue poppy",
    latin: "Meconopsis",
    color: "#6f87ba",
    center: "#d4b458",
    category: "filler",
    availability: "play",
    note: "Studio-only inspiration",
  },
  {
    kind: "eucalyptus",
    name: "Silver dollar eucalyptus",
    latin: "Eucalyptus cinerea",
    color: "#829078",
    center: "#617356",
    category: "foliage",
    availability: "available",
    note: "Soft, rounded foliage",
  },
  {
    kind: "gerbera",
    name: "Gerbera",
    latin: "Gerbera jamesonii",
    color: "#e58b4d",
    center: "#513a2b",
    category: "main",
    availability: "available",
    note: "Bright, open focal blooms",
  },
  {
    kind: "chrysanthemum",
    name: "Chrysanthemum",
    latin: "Chrysanthemum",
    color: "#e4c477",
    center: "#a97835",
    category: "main",
    availability: "available",
    note: "Layered autumn texture",
  },
  {
    kind: "hydrangea",
    name: "Hydrangea",
    latin: "Hydrangea macrophylla",
    color: "#b8a8c7",
    center: "#786987",
    category: "main",
    availability: "available",
    note: "A generous cloud of petals",
  },
  {
    kind: "lily-of-the-valley",
    name: "Lily of the valley",
    latin: "Convallaria majalis",
    color: "#f1ead6",
    center: "#b5a979",
    category: "filler",
    availability: "available",
    note: "Small, hanging spring bells",
  },
  {
    kind: "fern",
    name: "Fern greenery",
    latin: "Fern",
    color: "#78906c",
    center: "#53674b",
    category: "foliage",
    availability: "available",
    note: "Fine, airy greenery",
  },
  {
    kind: "seeded-eucalyptus",
    name: "Eucalyptus sprig",
    latin: "Eucalyptus",
    color: "#84947d",
    center: "#5f715b",
    category: "foliage",
    availability: "available",
    note: "A soft silver-green branch",
  },
  // ── New main blooms ──────────────────────────────────────────────────────
  {
    kind: "sunflower",
    name: "Sunflower",
    latin: "Helianthus annuus",
    color: "#e8c145",
    center: "#5a3a1a",
    category: "main",
    availability: "available",
    note: "Bold summer focal bloom",
  },
  {
    kind: "orchid",
    name: "Orchid",
    latin: "Phalaenopsis",
    color: "#d4afc9",
    center: "#9c5e8a",
    category: "main",
    availability: "available",
    note: "Elegant, arching spray",
  },
  {
    kind: "calla-lily",
    name: "Calla lily",
    latin: "Zantedeschia",
    color: "#f0ece0",
    center: "#d4c49a",
    category: "main",
    availability: "available",
    note: "Clean, sculptural line",
  },
  {
    kind: "carnation",
    name: "Carnation",
    latin: "Dianthus caryophyllus",
    color: "#e5788a",
    center: "#c24b68",
    category: "main",
    availability: "available",
    note: "Ruffled, long-lasting bloom",
  },
  {
    kind: "lily",
    name: "Lily",
    latin: "Lilium",
    color: "#f7e8d0",
    center: "#c47a55",
    category: "main",
    availability: "available",
    note: "Stately, fragrant trumpet",
  },
  {
    kind: "lotus",
    name: "Lotus",
    latin: "Nelumbo nucifera",
    color: "#e8b4c0",
    center: "#c47a8a",
    category: "main",
    availability: "available",
    note: "Serene, layered petals",
  },
  {
    kind: "anemone",
    name: "Anemone",
    latin: "Anemone hybrida",
    color: "#f5f0e8",
    center: "#2d2d32",
    category: "main",
    availability: "available",
    note: "Painterly, dark-eyed blooms",
  },
  // ── New filler blooms ────────────────────────────────────────────────────
  {
    kind: "chamomile",
    name: "Chamomile",
    latin: "Matricaria chamomilla",
    color: "#f5f0d8",
    center: "#d4a830",
    category: "filler",
    availability: "available",
    note: "Meadow-fresh daisy clusters",
  },
  {
    kind: "delphinium",
    name: "Delphinium",
    latin: "Delphinium elatum",
    color: "#8faad0",
    center: "#5a7aaa",
    category: "filler",
    availability: "available",
    note: "Tall blue-violet spikes",
  },
  {
    kind: "snowdrop",
    name: "Snowdrop",
    latin: "Galanthus nivalis",
    color: "#f0efea",
    center: "#9ab89a",
    category: "filler",
    availability: "available",
    note: "Delicate hanging bells",
  },
  {
    kind: "lavender",
    name: "Lavender",
    latin: "Lavandula angustifolia",
    color: "#b8a8d0",
    center: "#7a6898",
    category: "filler",
    availability: "available",
    note: "Fragrant violet wands",
  },
  // ── New foliage ──────────────────────────────────────────────────────────
  {
    kind: "ivy",
    name: "Trailing ivy",
    latin: "Hedera helix",
    color: "#5a7850",
    center: "#3d5638",
    category: "foliage",
    availability: "available",
    note: "Cascading green tendrils",
  },
  {
    kind: "monstera",
    name: "Monstera leaf",
    latin: "Monstera deliciosa",
    color: "#4a7248",
    center: "#324e30",
    category: "foliage",
    availability: "available",
    note: "Bold, fenestrated leaf",
  },
];

// Cultivar colors are deliberately curated by species. Foliage stays botanical green.
const FLOWER_COLORS: Partial<Record<FlowerKind, FlowerColorOption[]>> = {
  rose: [
    { id: "natural", label: "Dusty rose", color: "#c76577", center: "#7d2632" },
    { id: "red", label: "Velvet red", color: "#b52f42", center: "#6f1e2c" },
    { id: "cream", label: "Ivory cream", color: "#eee2c9", center: "#c6a873" },
    { id: "yellow", label: "Butter yellow", color: "#e7c75f", center: "#9d7730" },
    { id: "orange", label: "Apricot", color: "#e8915e", center: "#9b4e32" },
    { id: "lavender", label: "Mauve", color: "#a981a7", center: "#684b72" },
  ],
  tulip: [
    { id: "natural", label: "Blush", color: "#e8c5be", center: "#b98e85" },
    { id: "red", label: "Tulip red", color: "#c8353e", center: "#40302b" },
    { id: "yellow", label: "Golden yellow", color: "#e8c64c", center: "#57422a" },
    { id: "white", label: "White", color: "#eee9dc", center: "#968665" },
    { id: "purple", label: "Violet", color: "#79568d", center: "#493455" },
  ],
  daisy: [
    { id: "natural", label: "Cream white", color: "#f3eee2", center: "#c7a24a" },
    { id: "yellow", label: "Golden daisy", color: "#e7c75f", center: "#9d7730" },
  ],
  poppy: [
    { id: "natural", label: "Coral", color: "#df7358", center: "#4b3b35" },
    { id: "red", label: "Scarlet", color: "#c73537", center: "#352d2a" },
    { id: "orange", label: "Orange", color: "#e77c35", center: "#40342d" },
    { id: "white", label: "White", color: "#eee9dc", center: "#40342d" },
  ],
  peony: [
    { id: "natural", label: "Blush pink", color: "#d89aae", center: "#a85d78" },
    { id: "white", label: "White", color: "#f0e9dc", center: "#c7a5a2" },
    { id: "coral", label: "Coral", color: "#df806f", center: "#a8484e" },
    { id: "red", label: "Deep red", color: "#a82d43", center: "#671c32" },
  ],
  "blue-poppy": [
    { id: "natural", label: "Himalayan blue", color: "#6f87ba", center: "#d4b458" },
    { id: "violet", label: "Violet blue", color: "#8174ad", center: "#d3b66c" },
    { id: "white", label: "White", color: "#eee9dc", center: "#d4b458" },
  ],
  gerbera: [
    { id: "natural", label: "Warm orange", color: "#e58b4d", center: "#513a2b" },
    { id: "red", label: "Red", color: "#c83a48", center: "#4c342c" },
    { id: "pink", label: "Pink", color: "#dc8190", center: "#513a2b" },
    { id: "yellow", label: "Yellow", color: "#e8c64c", center: "#513a2b" },
    { id: "white", label: "White", color: "#eee9dc", center: "#513a2b" },
  ],
  chrysanthemum: [
    { id: "natural", label: "Golden", color: "#e4c477", center: "#a97835" },
    { id: "white", label: "White", color: "#eee9dc", center: "#c8ad77" },
    { id: "pink", label: "Pink", color: "#d889a0", center: "#9e526a" },
    { id: "red", label: "Bronze red", color: "#b84f47", center: "#71352f" },
    { id: "lavender", label: "Lavender", color: "#a392bd", center: "#675578" },
  ],
  hydrangea: [
    { id: "natural", label: "Misty lilac", color: "#b8a8c7", center: "#786987" },
    { id: "blue", label: "Garden blue", color: "#779bc2", center: "#e3c77b" },
    { id: "pink", label: "Rose pink", color: "#d793aa", center: "#a45b79" },
    { id: "white", label: "White", color: "#eee9dc", center: "#c9b99a" },
  ],
  "lily-of-the-valley": [
    { id: "natural", label: "Ivory", color: "#f1ead6", center: "#b5a979" },
    { id: "white", label: "White", color: "#f6f3e9", center: "#c8bb91" },
    { id: "pink", label: "Soft pink", color: "#dba5ad", center: "#a76d78" },
  ],
  // ── New flower color options ─────────────────────────────────────────────
  sunflower: [
    { id: "natural", label: "Golden yellow", color: "#e8c145", center: "#5a3a1a" },
    { id: "terracotta", label: "Terracotta", color: "#c97a42", center: "#4a2810" },
    { id: "cream", label: "Lemon cream", color: "#f0e090", center: "#7a5a20" },
  ],
  orchid: [
    { id: "natural", label: "Blush mauve", color: "#d4afc9", center: "#9c5e8a" },
    { id: "white", label: "Pure white", color: "#f4eeea", center: "#d0a8c8" },
    { id: "yellow", label: "Butter yellow", color: "#e8d870", center: "#a87e30" },
    { id: "purple", label: "Deep violet", color: "#8060a8", center: "#502878" },
  ],
  "calla-lily": [
    { id: "natural", label: "Ivory", color: "#f0ece0", center: "#d4c49a" },
    { id: "white", label: "Snow white", color: "#f8f5ef", center: "#e0d0a8" },
    { id: "yellow", label: "Sunshine", color: "#f0d040", center: "#a88020" },
    { id: "pink", label: "Blush pink", color: "#e8b0c0", center: "#c07090" },
    { id: "black", label: "Dark plum", color: "#503848", center: "#302030" },
  ],
  carnation: [
    { id: "natural", label: "Rose pink", color: "#e5788a", center: "#c24b68" },
    { id: "red", label: "Scarlet", color: "#c83030", center: "#801820" },
    { id: "white", label: "White", color: "#f4f0e8", center: "#d8c8b0" },
    { id: "yellow", label: "Butter", color: "#e8d050", center: "#a88830" },
    { id: "purple", label: "Lavender", color: "#b090c8", center: "#785890" },
    { id: "orange", label: "Apricot", color: "#e89050", center: "#a84820" },
  ],
  lily: [
    { id: "natural", label: "Ivory peach", color: "#f7e8d0", center: "#c47a55" },
    { id: "white", label: "White", color: "#f8f4ee", center: "#e0c8a8" },
    { id: "pink", label: "Stargazer pink", color: "#e878a0", center: "#b83870" },
    { id: "orange", label: "Tiger orange", color: "#e87840", center: "#804020" },
    { id: "yellow", label: "Golden", color: "#e8c840", center: "#986820" },
  ],
  lotus: [
    { id: "natural", label: "Blush pink", color: "#e8b4c0", center: "#c47a8a" },
    { id: "white", label: "Pure white", color: "#f4f0e8", center: "#d0b898" },
    { id: "deep-pink", label: "Deep rose", color: "#c85880", center: "#903060" },
  ],
  anemone: [
    { id: "natural", label: "White", color: "#f5f0e8", center: "#2d2d32" },
    { id: "pink", label: "Soft pink", color: "#e8a0b0", center: "#282830" },
    { id: "purple", label: "Deep violet", color: "#8070b8", center: "#282030" },
    { id: "red", label: "Crimson", color: "#c03040", center: "#1a1820" },
    { id: "blue", label: "Cobalt blue", color: "#5878c8", center: "#202838" },
  ],
  chamomile: [
    { id: "natural", label: "Cream white", color: "#f5f0d8", center: "#d4a830" },
    { id: "yellow", label: "Golden daisy", color: "#e8d048", center: "#c07820" },
  ],
  delphinium: [
    { id: "natural", label: "Cornflower blue", color: "#8faad0", center: "#5a7aaa" },
    { id: "white", label: "White", color: "#f0eee8", center: "#b8b0d0" },
    { id: "purple", label: "Violet purple", color: "#7858b0", center: "#503880" },
    { id: "pink", label: "Soft pink", color: "#e8a0b8", center: "#b86090" },
  ],
  snowdrop: [
    { id: "natural", label: "Snow white", color: "#f0efea", center: "#9ab89a" },
  ],
  lavender: [
    { id: "natural", label: "Classic purple", color: "#b8a8d0", center: "#7a6898" },
    { id: "pink", label: "Rose lavender", color: "#d8a0c0", center: "#a06888" },
    { id: "white", label: "White spike", color: "#f0eee8", center: "#c8c0d8" },
  ],
};

function getFlowerColors(kind: FlowerKind) {
  return FLOWER_COLORS[kind] ?? [];
}

function getFlowerColor(kind: FlowerKind, variant?: string) {
  const options = getFlowerColors(kind);
  return options.find((option) => option.id === variant) ?? options[0] ?? null;
}

const VESSEL_OPTIONS: { kind: VesselKind; name: string; category: "vase" | "bouquet"; note: string }[] = [
  { kind: "classic", name: "Soft ceramic", category: "vase", note: "Rounded studio vase" },
  { kind: "bud", name: "Bud vase", category: "vase", note: "A quiet, narrow silhouette" },
  { kind: "bowl", name: "Wide bowl", category: "vase", note: "Low and generous" },
  { kind: "footed", name: "Footed urn", category: "vase", note: "A little ceremony" },
  { kind: "mug", name: "Tea cup", category: "vase", note: "An everyday vessel" },
  { kind: "paper", name: "Paper wrap", category: "bouquet", note: "Warm folded kraft paper" },
  // Keep the legacy `canvas` id so older shared bouquet links still restore.
  { kind: "canvas", name: "Paper + ribbon", category: "bouquet", note: "Folded paper tied with a bow" },
  { kind: "naked", name: "Naked", category: "bouquet", note: "Bare stems, simply tied" },
];

const VESSEL_COLORS = {
  ceramic: [
    { label: "Ivory", color: "#ddd4c2" },
    { label: "Porcelain", color: "#f0ede5" },
    { label: "Sage", color: "#8a9a83" },
    { label: "Terracotta", color: "#bf8064" },
    { label: "Cobalt", color: "#526c86" },
    { label: "Charcoal", color: "#424440" },
  ],
  wrap: [
    { label: "Kraft", color: "#d4bd96" },
    { label: "Pearl", color: "#eee6d6" },
    { label: "Stone", color: "#b9b9b3" },
    { label: "Blush", color: "#d3a1a3" },
    { label: "Sage", color: "#929d83" },
    { label: "Forest", color: "#667561" },
  ],
} as const;

function getDefaultVesselColor(kind: VesselKind) {
  if (kind === "paper") return "#d4bd96";
  if (kind === "canvas") return "#b9b9b3";
  if (kind === "mug") return "#e2d9c4";
  return "#ddd4c2";
}

function getVesselColors(kind: VesselKind) {
  return kind === "paper" || kind === "canvas" ? VESSEL_COLORS.wrap : VESSEL_COLORS.ceramic;
}

const VASE_PROFILES: Record<Exclude<VesselKind, "paper" | "canvas" | "naked">, [number, number][]> = {
  classic: [[0.46, 0], [0.53, 0.08], [0.61, 0.34], [0.65, 0.72], [0.61, 1.04], [0.49, 1.34], [0.45, 1.42]],
  bud: [[0.34, 0], [0.39, 0.08], [0.45, 0.42], [0.3, 0.72], [0.22, 1.04], [0.23, 1.35], [0.3, 1.42]],
  bowl: [[0.55, 0], [0.62, 0.08], [0.77, 0.38], [0.8, 0.72], [0.73, 1.02], [0.68, 1.32], [0.7, 1.42]],
  footed: [[0.24, 0], [0.35, 0.08], [0.18, 0.2], [0.15, 0.55], [0.34, 0.7], [0.58, 0.84], [0.67, 1.18], [0.62, 1.38], [0.55, 1.42]],
  mug: [[0.4, 0], [0.48, 0.08], [0.5, 0.22], [0.5, 1.1], [0.48, 1.31], [0.49, 1.42]],
};

const BOUQUET_PRESETS: {
  id: string;
  name: string;
  note: string;
  vessel: VesselKind;
  stems: { kind: FlowerKind; height: number; leanX: number; leanZ: number; z: number }[];
}[] = [
  {
    id: "first-light",
    name: "First light",
    note: "Rose · tulip · silver green",
    vessel: "classic",
    stems: [
      { kind: "rose", height: 2.8, leanX: -0.58, leanZ: -0.04, z: -0.12 },
      { kind: "rose", height: 3.05, leanX: 0.05, leanZ: 0.03, z: 0.13 },
      { kind: "tulip", height: 2.75, leanX: 0.55, leanZ: -0.04, z: -0.05 },
      { kind: "lily-of-the-valley", height: 2.2, leanX: -0.85, leanZ: 0.1, z: 0.18 },
      { kind: "eucalyptus", height: 3.0, leanX: -1.02, leanZ: -0.08, z: -0.18 },
      { kind: "seeded-eucalyptus", height: 2.75, leanX: 0.98, leanZ: 0.08, z: 0.06 },
    ],
  },
  {
    id: "meadow-air",
    name: "Meadow air",
    note: "Gerbera · poppy · fern",
    vessel: "paper",
    stems: [
      { kind: "gerbera", height: 3.0, leanX: -0.54, leanZ: -0.06, z: -0.12 },
      { kind: "poppy", height: 3.15, leanX: 0.3, leanZ: 0.03, z: 0.06 },
      { kind: "daisy", height: 2.55, leanX: 0.88, leanZ: -0.1, z: 0.17 },
      { kind: "lily-of-the-valley", height: 2.25, leanX: -0.9, leanZ: 0.14, z: 0.15 },
      { kind: "fern", height: 2.95, leanX: -1.1, leanZ: -0.09, z: -0.17 },
      { kind: "eucalyptus", height: 2.85, leanX: 1.05, leanZ: 0.12, z: -0.05 },
    ],
  },
  {
    id: "cloud-study",
    name: "Cloud study",
    note: "Hydrangea · chrysanthemum",
    vessel: "naked",
    stems: [
      { kind: "hydrangea", height: 2.75, leanX: -0.35, leanZ: -0.06, z: -0.1 },
      { kind: "hydrangea", height: 3.0, leanX: 0.52, leanZ: 0.07, z: 0.12 },
      { kind: "chrysanthemum", height: 3.1, leanX: -0.9, leanZ: 0.04, z: 0.18 },
      { kind: "tulip", height: 2.55, leanX: 0.96, leanZ: -0.1, z: -0.16 },
      { kind: "fern", height: 2.9, leanX: -1.22, leanZ: 0.12, z: -0.05 },
      { kind: "seeded-eucalyptus", height: 3.05, leanX: 1.18, leanZ: -0.06, z: 0.02 },
    ],
  },
];

const CATEGORY_LABELS: Record<FlowerCategory, { label: string; subtitle: string }> = {
  main: { label: "Main flowers", subtitle: "主花" },
  filler: { label: "Accents", subtitle: "配花" },
  foliage: { label: "Foliage", subtitle: "葉材" },
};

const DEFAULT_LIGHT_DIRECTION = -42;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

function getSpec(kind: FlowerKind) {
  return FLOWERS.find((item) => item.kind === kind) ?? FLOWERS[0];
}

const AUTO_PLACEMENT_SLOTS = [
  { leanX: 0, height: 2.82, z: 0 },
  { leanX: -0.56, height: 2.94, z: -0.1 },
  { leanX: 0.62, height: 2.68, z: 0.12 },
  { leanX: -1.02, height: 2.76, z: 0.16 },
  { leanX: 1.04, height: 2.84, z: -0.16 },
  { leanX: -0.18, height: 2.46, z: 0.18 },
  { leanX: 0.22, height: 3.02, z: -0.18 },
  { leanX: -0.76, height: 2.56, z: 0.02 },
  { leanX: 1.16, height: 2.64, z: 0.1 },
  { leanX: -1.2, height: 2.62, z: -0.08 },
  { leanX: 0.52, height: 2.48, z: -0.04 },
  { leanX: -0.34, height: 3.04, z: 0.04 },
];

function stemInsertionY(vessel: VesselKind) {
  return vessel === "naked" ? 0.36 : vessel === "paper" || vessel === "canvas" ? 0.58 : 1.43;
}

function autoPlacementPoint(kind: FlowerKind, index: number, vessel: VesselKind) {
  const slot = AUTO_PLACEMENT_SLOTS[index % AUTO_PLACEMENT_SLOTS.length];
  const category = getSpec(kind).category;
  const heightOffset = category === "filler" ? -0.18 : category === "foliage" ? 0.02 : 0.12;
  return new THREE.Vector3(0.72 + slot.leanX, stemInsertionY(vessel) + slot.height + heightOffset, slot.z);
}

function FlowerStem({
  stem,
  stemBaseY = 1.43,
  wind,
  selected,
  ghost = false,
  onSelect,
  onDragStart,
}: {
  stem: Stem;
  stemBaseY?: number;
  wind: number;
  selected?: boolean;
  ghost?: boolean;
  onSelect?: (id: string) => void;
  onDragStart?: (id: string, event: ThreeEvent<PointerEvent>) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const importedVisual = useRef<THREE.Group>(null);
  const importedSelectionRing = useRef<THREE.Mesh>(null);
  const spec = getSpec(stem.kind);
  const colorOption = getFlowerColor(stem.kind, stem.colorVariant);
  const bloomColor = colorOption?.color ?? spec.color;
  const importedTint = colorOption && (
    (stem.kind !== "peony" && stem.kind !== "hydrangea" && stem.kind !== "daisy") ||
    (stem.colorVariant && stem.colorVariant !== "natural")
  ) ? bloomColor : undefined;
  const displayHeight = stem.height;
  const headHeight = flowerHeadHeight(stem.kind);
  const stalkHeight = Math.max(0.1, displayHeight - headHeight);
  const stemLeanMatrix = useMemo(() => new THREE.Matrix4().set(
    1, stem.leanX / displayHeight, 0, 0,
    0, 1, 0, 0,
    0, stem.leanZ / displayHeight, 1, 0,
    0, 0, 0, 1,
  ), [stem.leanX, stem.leanZ, displayHeight]);

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(
          stem.leanX * 0.16,
          stalkHeight * 0.34,
          stem.leanZ * 0.13,
        ),
        new THREE.Vector3(
          stem.leanX * 0.48,
          stalkHeight * 0.7,
          stem.leanZ * 0.4,
        ),
        new THREE.Vector3(
          stem.leanX,
          stalkHeight,
          stem.leanZ,
        ),
      ]),
    [stalkHeight, stem.leanX, stem.leanZ],
  );

  const tip = useMemo(() => curve.getPoint(1), [curve]);

  useFrame(({ clock }) => {
    if (!group.current || ghost) return;
    const t = clock.elapsedTime;
    const breeze = selected ? 0 : wind * 0.009;
    group.current.rotation.z =
      Math.sin(t * 1.3 + stem.seed) * breeze;
    group.current.rotation.x =
      Math.cos(t * 0.95 + stem.seed * 1.7) * breeze * 0.5;
    if (selected && importedVisual.current && importedSelectionRing.current) {
      const bounds = new THREE.Box3().setFromObject(importedVisual.current);
      if (!bounds.isEmpty()) {
        const center = new THREE.Vector3(
          (bounds.min.x + bounds.max.x) / 2,
          bounds.max.y - Math.min((bounds.max.y - bounds.min.y) * 0.23, 0.5),
          (bounds.min.z + bounds.max.z) / 2,
        );
        group.current.worldToLocal(center);
        importedSelectionRing.current.position.copy(center);
        importedSelectionRing.current.visible = true;
      } else {
        importedSelectionRing.current.visible = false;
      }
    }
  });

  const pointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (ghost || event.button !== 0) return;
    event.stopPropagation();
    onSelect?.(stem.id);
    onDragStart?.(stem.id, event);
  };

  return (
    <group
      ref={group}
      position={[stem.x, stemBaseY, stem.z]}
      onPointerDown={pointerDown}
      onPointerOver={(e) => { if (!ghost) { e.stopPropagation(); document.body.style.cursor = "grab"; } }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      {IMPORTED_STEMS[spec.kind] ? (
        <>
          <group ref={importedVisual} matrix={stemLeanMatrix} matrixAutoUpdate={false}>
              <ImportedStem kind={spec.kind} ghost={ghost} height={displayHeight} bloomColor={importedTint} fallback={null} />
          </group>
          {selected && !ghost && <mesh ref={importedSelectionRing} visible={false} raycast={() => null}>
            <torusGeometry args={[0.52, 0.008, 6, 64]} /><meshBasicMaterial color="#85906d" transparent opacity={0.65} />
          </mesh>}
        </>
      ) : (
        <>
          <mesh castShadow>
            <tubeGeometry args={[curve, 28, 0.021, 7, false]} />
            <meshStandardMaterial color="#617356" roughness={0.82} transparent={ghost} opacity={ghost ? 0.38 : 1} />
          </mesh>
          <group position={[tip.x, tip.y, tip.z]}>
            <ImportedFlower kind={spec.kind} ghost={ghost} bloomColor={importedTint} fallback={null} />
            {selected && !ghost && <mesh position={[0, headHeight / 2, 0.08]}>
              <torusGeometry args={[0.5, 0.008, 6, 64]} /><meshBasicMaterial color="#85906d" transparent opacity={0.65} />
            </mesh>}
          </group>
        </>
      )}
    </group>
  );
}

function paperWrapGeometry(flowerCount: number) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];
  const radialSteps = 48;
  const heightSteps = 12;
  const fullness = clamp((flowerCount - 1) / 8, 0, 1);
  const topHeight = 3.05 + fullness;
  const flare = 0.73 + fullness * 0.57;
  for (let i = 0; i <= radialSteps; i++) {
    const angle = -Math.PI + i / radialSteps * Math.PI * 2;
    const front = (1 + Math.cos(angle)) / 2;
    const top = topHeight - (0.58 + fullness * 0.7) * Math.pow(front, 4) + 0.06 * Math.cos(angle * 3);
    for (let j = 0; j <= heightSteps; j++) {
      const t = j / heightSteps;
      const fold = 1 + (0.017 * Math.cos(angle * 9) + 0.009 * Math.sin(angle * 15)) * t;
      const radius = (0.27 + (flare - 0.27) * Math.pow(t, 1.28)) * fold;
      const y = 0.62 + (top - 0.62) * t;
      positions.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
      if (i < radialSteps && j < heightSteps) {
        const a = i * (heightSteps + 1) + j;
        const b = a + heightSteps + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Vase({ kind, vesselColor, vesselOpacity, flowerCount = 1 }: { kind: VesselKind; vesselColor: string; vesselOpacity: number; flowerCount?: number }) {
  const profileKind = kind === "paper" || kind === "canvas" || kind === "naked" ? "classic" : kind;
  const points = useMemo(() => VASE_PROFILES[profileKind].map(([radius, height]) => new THREE.Vector2(radius, height)), [profileKind]);
  const ribbonTails = useMemo(() => {
    const left = new THREE.Shape();
    left.moveTo(-0.02, 0.16);
    left.lineTo(-0.25, -0.13);
    left.lineTo(-0.17, -0.29);
    left.lineTo(-0.03, -0.15);
    left.closePath();
    const right = new THREE.Shape();
    right.moveTo(0.02, 0.16);
    right.lineTo(0.25, -0.13);
    right.lineTo(0.17, -0.29);
    right.lineTo(0.03, -0.15);
    right.closePath();
    return [left, right];
  }, []);
  const rimRadius = kind === "bowl" ? 0.7 : kind === "bud" ? 0.3 : kind === "mug" ? 0.49 : kind === "footed" ? 0.55 : 0.45;
  const alpha = clamp(vesselOpacity / 100, 0.25, 1);
  const alphaProps = { transparent: alpha < 1, opacity: alpha, depthWrite: alpha === 1 };
  const wrapGeometry = useMemo(() => paperWrapGeometry(flowerCount), [flowerCount]);

  if (kind === "naked") {
    return <group>
      <mesh position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.025, 8, 32]} /><meshStandardMaterial color="#a28b69" roughness={0.95} />
      </mesh>
      <mesh position={[0.22, 0.62, 0]}>
        <sphereGeometry args={[0.055, 10, 8]} /><meshStandardMaterial color="#b6a07d" roughness={0.95} />
      </mesh>
    </group>;
  }

  if (kind === "paper" || kind === "canvas") {
    return <group>
      <mesh geometry={wrapGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial {...alphaProps} color={vesselColor} roughness={0.96} side={THREE.DoubleSide} flatShading />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.34, 0.56, 12, 1]} />
        <meshStandardMaterial {...alphaProps} color={vesselColor} roughness={1} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.026, 8, 32]} /><meshStandardMaterial {...alphaProps} color={kind === "paper" ? "#9e8a6d" : "#eee8dc"} roughness={0.98} />
      </mesh>
      {kind === "canvas" ? <group>
        <mesh position={[0, 0.59, 0.37]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.026, 8, 40]} /><meshStandardMaterial {...alphaProps} color="#eee8dc" roughness={0.84} />
        </mesh>
        <mesh position={[-0.2, 0.63, 0.37]} rotation={[0, 0, -0.32]} scale={[1, 1, 0.28]}>
          <sphereGeometry args={[0.22, 18, 12]} /><meshStandardMaterial {...alphaProps} color="#f4efe4" roughness={0.8} />
        </mesh>
        <mesh position={[0.2, 0.63, 0.37]} rotation={[0, 0, 0.32]} scale={[1, 1, 0.28]}>
          <sphereGeometry args={[0.22, 18, 12]} /><meshStandardMaterial {...alphaProps} color="#f4efe4" roughness={0.8} />
        </mesh>
        {ribbonTails.map((tail, index) => <mesh key={index} position={[0, 0.48, 0.39 + index * 0.002]}>
          <shapeGeometry args={[tail]} /><meshStandardMaterial {...alphaProps} color="#eee8dc" roughness={0.84} side={THREE.DoubleSide} />
        </mesh>)}
        <mesh position={[0, 0.62, 0.43]} scale={[0.11, 0.09, 0.075]}>
          <sphereGeometry args={[1, 18, 12]} /><meshStandardMaterial {...alphaProps} color="#e8dfcf" roughness={0.78} />
        </mesh>
      </group> : null}
    </group>;
  }

  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[points, 48]} />
        <meshPhysicalMaterial {...alphaProps} color={vesselColor} roughness={0.62} metalness={0} clearcoat={0.16} clearcoatRoughness={0.72} />
      </mesh>
      <mesh position={[0, 1.414, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rimRadius, 0.032, 10, 48]} /><meshStandardMaterial color="#b8b09f" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.408, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[rimRadius - 0.035, 48]} /><meshStandardMaterial color="#6d7461" roughness={0.96} />
      </mesh>
      {kind === "mug" && <mesh position={[0.53, 0.78, 0]} scale={[0.74, 0.74, 0.22]}>
        <torusGeometry args={[0.45, 0.085, 10, 32]} /><meshPhysicalMaterial {...alphaProps} color={vesselColor} roughness={0.62} clearcoat={0.16} />
      </mesh>}
    </group>
  );
}

function PreviewCanvas({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={`asset-preview ${className}`} aria-hidden="true">
    <Canvas
      frameloop="demand"
      dpr={1}
      camera={{ position: [0, 0.65, 5.6], fov: 27, near: 0.1, far: 20 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <hemisphereLight args={["#fffdf6", "#b6ad98", 1.45]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 5]} intensity={1.9} />
      {children}
    </Canvas>
  </div>;
}

function FlowerThumbnail({ kind }: { kind: FlowerKind }) {
  const stem = useMemo<Stem>(() => ({
    id: `catalog-${kind}`,
    kind,
    x: 0,
    z: 0,
    height: 2.35,
    leanX: 0.08,
    leanZ: 0.02,
    seed: 1.7,
  }), [kind]);

  return <PreviewCanvas className="flower-art">
    <group position={[0, -0.78, 0]} scale={0.72}>
      <FlowerStem stem={stem} stemBaseY={0} wind={0} />
    </group>
  </PreviewCanvas>;
}

function VesselThumbnail({ option, vesselColor, vesselOpacity }: {
  option: (typeof VESSEL_OPTIONS)[number];
  vesselColor: string;
  vesselOpacity: number;
}) {
  const sampleKinds: FlowerKind[] = option.kind === "naked"
    ? ["rose", "tulip", "fern"]
    : ["rose", "tulip", "lily-of-the-valley", "eucalyptus"];
  const wrapped = option.kind === "paper" || option.kind === "canvas";
  const stemBaseY = option.kind === "naked" ? 0.36 : wrapped ? 0.58 : 1.43;

  return <PreviewCanvas className="vessel-art">
    <group position={[0, wrapped ? -0.68 : -0.78, 0]} scale={wrapped ? 0.49 : 0.79}>
      <Vase kind={option.kind} vesselColor={vesselColor} vesselOpacity={vesselOpacity} flowerCount={option.category === "bouquet" ? sampleKinds.length : 0} />
      {option.category === "bouquet" ? sampleKinds.map((kind, index) => <FlowerStem
        key={`${kind}-${index}`}
        stem={{ id: `wrap-${option.kind}-${index}`, kind, x: (index - (sampleKinds.length - 1) / 2) * 0.08,
          z: (index % 2 ? 1 : -1) * 0.08, height: 2.35 + (index % 2) * 0.18,
          leanX: (index - (sampleKinds.length - 1) / 2) * 0.34, leanZ: index % 2 ? 0.05 : -0.04, seed: index * 1.2 }}
        stemBaseY={stemBaseY}
       
        wind={0}
      />) : null}
    </group>
  </PreviewCanvas>;
}

function BouquetThumbnail({ preset }: { preset: (typeof BOUQUET_PRESETS)[number] }) {
  const wrapped = preset.vessel === "paper" || preset.vessel === "canvas";
  const stemBaseY = preset.vessel === "naked" ? 0.36 : wrapped ? 0.58 : 1.43;

  return <PreviewCanvas className="bouquet-art">
    <group position={[0, wrapped ? -0.68 : -1.05, 0]} scale={0.44}>
      <Vase kind={preset.vessel} vesselColor={getDefaultVesselColor(preset.vessel)} vesselOpacity={100} flowerCount={preset.stems.length} />
      {preset.stems.map((stem, index) => <FlowerStem
        key={`${stem.kind}-${index}`}
        stem={{ ...stem, id: `preset-${preset.id}-${index}`, x: (index - (preset.stems.length - 1) / 2) * 0.055, seed: index * 1.73 + 1.2 }}
        stemBaseY={stemBaseY}
       
        wind={0}
      />)}
    </group>
  </PreviewCanvas>;
}

function StemAdjustmentControls({
  stem,
  stems,
  colors,
  colorVariant,
  onSelectStem,
  onStartChange,
  onHeightChange,
  onAngleChange,
  onColorChange,
  onRemove,
  onDone,
}: {
  stem: Stem;
  stems: Stem[];
  colors: FlowerColorOption[];
  colorVariant: string;
  onSelectStem: (id: string) => void;
  onStartChange: () => void;
  onHeightChange: (value: number) => void;
  onAngleChange: (value: number) => void;
  onColorChange: (variant: string) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  return <div className="selection-card" aria-label="Selected stem controls">
    <div className="selection-title">
      <div>
        <strong>{getSpec(stem.kind).name}</strong>
        <div className="selection-meta">Drag the flower to reshape the line</div>
      </div>
      <button type="button" className="selection-done" aria-label="Done adjusting" onClick={onDone}><Check size={15} strokeWidth={1.5} /></button>
    </div>
    {stems.length > 1 ? <label className="selection-stem-picker" htmlFor="selected-stem">
      <span>Flower to adjust</span>
      <select id="selected-stem" value={stem.id} onChange={(event) => onSelectStem(event.target.value)}>
        {stems.map((item, index) => <option key={item.id} value={item.id}>{String(index + 1).padStart(2, "0")} · {getSpec(item.kind).name}</option>)}
      </select>
    </label> : null}
    <div className="micro-control">
      <label htmlFor="stem-height"><span>Stem height</span><span>{Math.round(stem.height * 28)} cm</span></label>
      <input onPointerDown={onStartChange} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) onStartChange(); }}
        id="stem-height" className="range" type="range" min="0.8" max="3.2" step="0.01" value={stem.height}
        onChange={(event) => onHeightChange(Number(event.target.value))} />
    </div>
    <div className="micro-control">
      <label htmlFor="stem-angle"><span>Lean / angle</span><span>{Math.round(Math.atan2(stem.leanX, Math.max(0.8, stem.height)) * 180 / Math.PI)}°</span></label>
      <input onPointerDown={onStartChange} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) onStartChange(); }}
        id="stem-angle" className="range" type="range" min="-1.5" max="1.5" step="0.01" value={stem.leanX}
        onChange={(event) => onAngleChange(Number(event.target.value))} />
    </div>
    {colors.length > 0 ? <div className="micro-control color-control">
      <span className="color-label">Flower color</span>
      <div className="color-options" role="group" aria-label="Flower color">
        {colors.map((option) => <button key={option.id} type="button" className="color-option"
          style={{ "--petal-color": option.color } as React.CSSProperties}
          aria-label={option.label} aria-pressed={colorVariant === option.id} title={option.label}
          onClick={() => onColorChange(option.id)}><span /></button>)}
      </div>
    </div> : null}
    <button type="button" className="remove-button" onClick={onRemove}>Remove this stem</button>
  </div>;
}

function CameraRig() {
  const { size } = useThree();
  return <OrthographicCamera
    makeDefault
    position={[0.72, 4, 12]}
    rotation={[-Math.atan2(0.75, 12), 0, 0]}
    zoom={size.height / 10.5}
    near={0.1}
    far={30}
  />;
}

function PreviewStem({
  kind,
  point,
  stemBaseY,
}: {
  kind: FlowerKind;
  point: THREE.Vector3;
  stemBaseY: number;
}) {
  const stem = useMemo<Stem>(
    () => ({
      id: "preview",
      kind,
      x: 0,
      z: clamp(point.z, -0.25, 0.25),
      height: clamp(point.y - stemBaseY, 0.8, 3.2),
      leanX: clamp(point.x - 0.72, -1.7, 1.7),
      leanZ: clamp(point.z - clamp(point.z, -0.25, 0.25), -0.5, 0.5),
      seed: 2.2,
    }),
    [kind, point.x, point.y, point.z, stemBaseY],
  );

  return <FlowerStem stem={stem} stemBaseY={stemBaseY} wind={0} ghost />;
}

function StudioScene({
  stems,
  lightWarmth,
  lightDirection,
  wind,
  vessel,
  vesselColor,
  vesselOpacity,
  bouquetRotation,
  held,
  selectedId,
  dragId,
  onSelect,
  onDragStart,
  onPlace,
  onDrag,
  onDragEnd,
  onRotateStart,
  onRotate,
  projectPointerRef,
}: {
  stems: Stem[];
  lightWarmth: number;
  lightDirection: number;
  wind: number;
  vessel: VesselKind;
  vesselColor: string;
  vesselOpacity: number;
  bouquetRotation: BouquetRotation;
  held: FlowerKind | null;
  selectedId: string | null;
  dragId: string | null;
  onSelect: (id: string | null) => void;
  onDragStart: (id: string) => void;
  onPlace: (point: THREE.Vector3) => void;
  onDrag: (id: string, point: THREE.Vector3) => void;
  onDragEnd: () => void;
  onRotateStart: () => void;
  onRotate: (rotation: BouquetRotation) => void;
  projectPointerRef: React.RefObject<((x: number, y: number) => THREE.Vector3 | null) | null>;
}) {
  const bouquetGroupRef = useRef<THREE.Group>(null);
  const wrapped = vessel === "paper" || vessel === "canvas";
  const stemBaseY = vessel === "naked" ? 0.36 : wrapped ? 0.58 : 1.43;
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverPoint, setHoverPoint] = useState(
    () => new THREE.Vector3(0.72, 3.7, 0),
  );

  const { camera, gl } = useThree();
  const setCanvasCursor = useCallback((cursor: string) => {
    if (canvasElementRef.current) canvasElementRef.current.style.cursor = cursor;
  }, []);
  useEffect(() => {
    canvasElementRef.current = gl.domElement;
    return () => { canvasElementRef.current = null; };
  }, [gl]);
  const pointToStudioSpace = useCallback((worldPoint: THREE.Vector3) => {
    const point = worldPoint.clone();
    if (bouquetGroupRef.current) bouquetGroupRef.current.worldToLocal(point);
    return point.add(new THREE.Vector3(0.72, 0.06, 0));
  }, []);
  useEffect(() => {
    projectPointerRef.current = (x, y) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), camera);
      const point = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3());
      if (!point) return null;
      const studioPoint = pointToStudioSpace(point);
      setHoverPoint(studioPoint);
      return studioPoint;
    };
    return () => { projectPointerRef.current = null; };
  }, [camera, gl, pointToStudioSpace, projectPointerRef]);
  const drag = useRef<{ id: string; plane: THREE.Plane; offset: THREE.Vector3; pointerId: number; started: boolean; origin: THREE.Vector3 } | null>(null);
  const rotationDrag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    start: BouquetRotation;
    mode: "orbit" | "roll";
    started: boolean;
  } | null>(null);
  const beginDrag = (id: string, event: ThreeEvent<PointerEvent>) => {
    if (held) { onPlace(pointToStudioSpace(event.point)); return; }
    const stem = stems.find((item) => item.id === id)!;
    const localTip = new THREE.Vector3(stem.x + stem.leanX, stemBaseY + stem.height, stem.z + stem.leanZ);
    const tip = bouquetGroupRef.current?.localToWorld(localTip.clone()) ?? localTip.add(new THREE.Vector3(0.72, 0.06, 0));
    const rotation = bouquetGroupRef.current?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, tip);
    const hit = event.ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return;
    drag.current = { id, plane, offset: tip.clone().sub(hit), pointerId: event.pointerId, started: false, origin: tip.clone() };
    gl.domElement.setPointerCapture(event.pointerId);
  };
  const beginBouquetRotate = (event: ThreeEvent<PointerEvent>) => {
    if (held) {
      event.stopPropagation();
      onPlace(pointToStudioSpace(event.point));
      return;
    }
    if (event.button !== 0) return;
    event.stopPropagation();
    rotationDrag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: { ...bouquetRotation },
      mode: event.shiftKey ? "roll" : "orbit",
      started: false,
    };
    gl.domElement.setPointerCapture(event.pointerId);
    setCanvasCursor("grabbing");
  };
  const recordDragStart = useEffectEvent((id: string) => onDragStart(id));
  const recordRotationStart = useEffectEvent(() => onRotateStart());
  const applyRotation = useEffectEvent((rotation: BouquetRotation) => onRotate(rotation));
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const move = (event: PointerEvent) => {
      const turning = rotationDrag.current;
      if (turning && event.pointerId === turning.pointerId) {
        const dx = event.clientX - turning.x;
        const dy = event.clientY - turning.y;
        if (Math.hypot(dx, dy) < 4) return;
        if (!turning.started) {
          turning.started = true;
          recordRotationStart();
        }
        if (turning.mode === "roll") {
          applyRotation({ ...turning.start, z: clamp(turning.start.z + dx * 0.5, -35, 35) });
        } else {
          applyRotation({
            ...turning.start,
            x: clamp(turning.start.x + dy * 0.45, -35, 35),
            y: clamp(turning.start.y + dx * 0.65, -180, 180),
          });
        }
        return;
      }
      const active = drag.current;
      if (!active || event.pointerId !== active.pointerId) return;
      const rect = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const point = raycaster.ray.intersectPlane(active.plane, new THREE.Vector3());
      if (point) {
        point.add(active.offset);
        if (!active.started) {
          if (point.distanceTo(active.origin) < 0.015) return;
          active.started = true;
          recordDragStart(active.id);
        }
        onDrag(active.id, pointToStudioSpace(point));
      }
    };
    const end = () => {
      const active = drag.current;
      if (active && gl.domElement.hasPointerCapture(active.pointerId)) gl.domElement.releasePointerCapture(active.pointerId);
      const turning = rotationDrag.current;
      if (turning && gl.domElement.hasPointerCapture(turning.pointerId)) gl.domElement.releasePointerCapture(turning.pointerId);
      drag.current = null;
      rotationDrag.current = null;
      setCanvasCursor("");
      document.body.style.cursor = "";
      onDragEnd();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end); window.removeEventListener("blur", end);
    };
  }, [camera, gl, onDrag, onDragEnd, pointToStudioSpace, setCanvasCursor]);

  const sceneColors = { fog: "#eee9dd", wall: "#eee9dd", key: "#fff4db", fill: "#d9e0d2" };
  const keyColor = new THREE.Color(sceneColors.key).lerp(
    new THREE.Color(lightWarmth < 0 ? "#c6e1ff" : "#ffba79"),
    Math.abs(lightWarmth) / 100 * 0.8,
  );
  const lightAngle = lightDirection * Math.PI / 180;

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (held) setHoverPoint(pointToStudioSpace(event.point));
  };

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    if (held) {
      event.stopPropagation();
      onPlace(pointToStudioSpace(event.point));
      return;
    }
    if (!dragId) onSelect(null);
  };

  return (
    <>
      <CameraRig />
      <fog attach="fog" args={[sceneColors.fog, 11, 20]} />
      <hemisphereLight args={["#fff7ec", "#8c9276", 0.8]} />
      <ambientLight
        intensity={1.1}
        color={sceneColors.fill}
      />
      <directionalLight
        castShadow
        position={[Math.sin(lightAngle) * 6.73, 7.4, Math.cos(lightAngle) * 6.73]}
        color={keyColor}
        intensity={2.1}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={7}
        shadow-camera-bottom={-2}
      />
      <pointLight
        position={[4, 3.5, 2]}
        intensity={0.7}
        color="#ffffff"
      />

      <mesh
        position={[0, 3.5, -3.8]}
        receiveShadow
      >
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial
          color={sceneColors.wall}
          roughness={1}
        />
      </mesh>

      <group
        ref={bouquetGroupRef}
        position={[0.72, 0.06, 0]}
        rotation={[bouquetRotation.x * Math.PI / 180, bouquetRotation.y * Math.PI / 180, bouquetRotation.z * Math.PI / 180]}
        onPointerDown={beginBouquetRotate}
        onPointerOver={(event) => {
          if (!held) {
            event.stopPropagation();
            setCanvasCursor("grab");
          }
        }}
        onPointerOut={() => {
          if (!rotationDrag.current) setCanvasCursor("");
        }}
      >
        <Vase key={vessel} kind={vessel} vesselColor={vesselColor} vesselOpacity={vesselOpacity} flowerCount={stems.length} />
        {stems.map((stem) => (
          <FlowerStem
            key={stem.id}
            stem={stem}
            stemBaseY={stemBaseY}
           
            wind={wind}
            selected={selectedId === stem.id}
            onSelect={onSelect}
            onDragStart={beginDrag}
          />
        ))}
        {held ? (
          <PreviewStem kind={held} point={hoverPoint} stemBaseY={stemBaseY} />
        ) : null}
      </group>

      <ContactShadows
        position={[0.72, 0.02, 0]}
        opacity={0.28}
        scale={5}
        blur={2.5}
        far={5}
      />

      <mesh
        position={[0, 2.7, 0]}
        onPointerMove={handleMove}
        onPointerDown={handleDown}
      >
        <planeGeometry args={[12, 6.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

function encodeBouquet(stems: Stem[], rotation: BouquetRotation, vessel: VesselKind, vesselColor: string, vesselOpacity: number) {
  const compact = stems.map(({ kind, x, z, height, leanX, leanZ, seed, colorVariant }) => ({ kind, x, z, height, leanX, leanZ, seed, colorVariant }));
  const raw = encodeURIComponent(JSON.stringify({ stems: compact, rotation, vessel, vesselColor, vesselOpacity }));
  return btoa(raw)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBouquet(value: string): { stems: Stem[]; rotation: BouquetRotation; vessel: VesselKind; vesselColor: string; vesselOpacity: number } | null {
  try {
    let normalized = value
      .replaceAll("-", "+")
      .replaceAll("_", "/");
    while (normalized.length % 4) normalized += "=";
    const decoded = decodeURIComponent(atob(normalized));
    const parsed = JSON.parse(decoded) as unknown;
    const shared = Array.isArray(parsed)
      ? { stems: parsed, rotation: DEFAULT_BOUQUET_ROTATION, vessel: "classic" as VesselKind }
      : parsed as { stems?: unknown; rotation?: Partial<BouquetRotation>; vessel?: unknown; vesselColor?: unknown; vesselOpacity?: unknown } | null;
    const parsedStems = shared && "stems" in shared ? shared.stems : null;
    const rotation = shared && "rotation" in shared && shared.rotation
      ? shared.rotation
      : DEFAULT_BOUQUET_ROTATION;
    const vessel = shared && "vessel" in shared && typeof shared.vessel === "string" && VESSEL_OPTIONS.some((option) => option.kind === shared.vessel)
      ? shared.vessel as VesselKind
      : "classic";
    const vesselColor = shared && typeof shared.vesselColor === "string" && getVesselColors(vessel).some((option) => option.color === shared.vesselColor)
      ? shared.vesselColor
      : getDefaultVesselColor(vessel);
    const vesselOpacity = shared && typeof shared.vesselOpacity === "number" && Number.isFinite(shared.vesselOpacity)
      ? clamp(shared.vesselOpacity, 25, 100)
      : 100;
    if (!Array.isArray(parsedStems)
      || ![rotation.x, rotation.y, rotation.z].every((value) => typeof value === "number" && Number.isFinite(value))
      || parsedStems.some((stem) => !stem || !FLOWERS.some((flower) => flower.kind === stem.kind)
      || ![stem.x, stem.z, stem.height, stem.leanX, stem.leanZ, stem.seed].every((value) => typeof value === "number" && Number.isFinite(value))
      || (stem.colorVariant !== undefined && (typeof stem.colorVariant !== "string" || !getFlowerColors(stem.kind).some((option) => option.id === stem.colorVariant))))) return null;
    return {
      stems: parsedStems.slice(0, 24).map((stem) => ({
        ...stem,
        x: clamp(stem.x, -0.3, 0.3), z: clamp(stem.z, -0.3, 0.3),
        height: clamp(stem.height, 0.8, 3.2), leanX: clamp(stem.leanX, -1.7, 1.7), leanZ: clamp(stem.leanZ, -0.5, 0.5),
        id: makeId(),
      })),
      rotation: {
        x: clamp(rotation.x ?? 0, -35, 35),
        y: clamp(rotation.y ?? 0, -180, 180),
        z: clamp(rotation.z ?? 0, -35, 35),
      },
      vessel,
      vesselColor,
      vesselOpacity,
    };
  } catch {
    return null;
  }
}

async function drawPostcard(imageUrl: string, to: string, message: string, from: string) {
  const photo = new Image();
  photo.src = imageUrl;
  await photo.decode();
  const card = document.createElement("canvas");
  card.width = 1000;
  card.height = 1400;
  const context = card.getContext("2d");
  if (!context) throw new Error("Could not draw the postcard");
  context.fillStyle = "#f9f7f0";
  context.fillRect(0, 0, card.width, card.height);
  context.fillStyle = "#e9e4d9";
  context.fillRect(42, 42, 916, 930);
  const scale = Math.min(916 / photo.width, 930 / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;
  context.drawImage(photo, 42 + (916 - width) / 2, 42 + (930 - height) / 2, width, height);
  context.fillStyle = "#817d72";
  context.font = "18px Arial, sans-serif";
  context.fillText("BLOOMROOM  ·  A GIFT OF FLOWERS", 72, 1022);
  context.fillStyle = "#24251f";
  context.font = "24px Arial, sans-serif";
  if (to) context.fillText(`To ${to},`, 72, 1080);
  let lines: string[] = [];
  let fontSize = 31;
  for (; fontSize >= 17; fontSize--) {
    context.font = `${fontSize}px Georgia, serif`;
    lines = [];
    let line = "";
    for (const character of Array.from(message || "May your day bloom in its own way.")) {
      if (character === "\n") { lines.push(line); line = ""; continue; }
      if (context.measureText(line + character).width > 850 && line) { lines.push(line); line = character; }
      else line += character;
    }
    if (line) lines.push(line);
    if (lines.length * fontSize * 1.35 <= 220) break;
  }
  lines.forEach((item, index) => context.fillText(item, 72, 1130 + index * fontSize * 1.35));
  if (from) {
    context.font = "24px Arial, sans-serif";
    context.textAlign = "right";
    context.fillText(`From ${from}`, 928, 1360);
  }
  return card.toDataURL("image/png");
}

export default function FlowerStudio() {
  const modelsLoading = useProgress((state) => state.active);
  const [stems, setStems] = useState<Stem[]>([]);
  const [vessel, setVessel] = useState<VesselKind>("classic");
  const [vesselColor, setVesselColor] = useState(getDefaultVesselColor("classic"));
  const [vesselOpacity, setVesselOpacity] = useState(100);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("flowers");
  const [vesselCategory, setVesselCategory] = useState<"vase" | "bouquet" | "imagination">("vase");
  const [held, setHeld] = useState<FlowerKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [lightWarmth, setLightWarmth] = useState(0);
  const [lightDirection, setLightDirection] = useState(DEFAULT_LIGHT_DIRECTION);
  const [category, setCategory] = useState<FlowerCategory>("main");
  const [wind, setWind] = useState(0.32);
  const [bouquetRotation, setBouquetRotation] = useState<BouquetRotation>({ ...DEFAULT_BOUQUET_ROTATION });
  const [rotationOpen, setRotationOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishImage, setFinishImage] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [sender, setSender] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const past = useRef<StudioSnapshot[]>([]);
  const future = useRef<StudioSnapshot[]>([]);
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const projectPointerRef = useRef<((x: number, y: number) => THREE.Vector3 | null) | null>(null);
  const paletteDrag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const checkpoint = useCallback(() => {
    past.current = [...past.current.slice(-39), { stems, rotation: bouquetRotation, vessel, vesselColor, vesselOpacity }];
    future.current = [];
    setHistoryState({ undo: past.current.length, redo: future.current.length });
  }, [bouquetRotation, stems, vessel, vesselColor, vesselOpacity]);
  const undo = () => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push({ stems, rotation: bouquetRotation, vessel, vesselColor, vesselOpacity });
    setStems(previous.stems);
    setBouquetRotation(previous.rotation);
    setVessel(previous.vessel);
    setVesselColor(previous.vesselColor);
    setVesselOpacity(previous.vesselOpacity);
    setSelectedId(null); setHeld(null); setHistoryState({ undo: past.current.length, redo: future.current.length });
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ stems, rotation: bouquetRotation, vessel, vesselColor, vesselOpacity });
    setStems(next.stems);
    setBouquetRotation(next.rotation);
    setVessel(next.vessel);
    setVesselColor(next.vesselColor);
    setVesselOpacity(next.vesselOpacity);
    setSelectedId(null); setHeld(null); setHistoryState({ undo: past.current.length, redo: future.current.length });
  };

  const selectedStem = stems.find((stem) => stem.id === selectedId) ?? null;
  const selectedColors = selectedStem ? getFlowerColors(selectedStem.kind) : [];
  const selectedColorVariant = selectedStem?.colorVariant ?? "natural";

  useEffect(() => {
    const value = window.location.hash.startsWith("#b=")
      ? window.location.hash.slice(3)
      : "";
    if (!value) return;
    const restored = decodeBouquet(value);
    if (restored?.stems.length) {
      queueMicrotask(() => {
        setStems(restored.stems);
        setBouquetRotation(restored.rotation);
        setVessel(restored.vessel);
        setVesselColor(restored.vesselColor);
        setVesselOpacity(restored.vesselOpacity);
        setToast("Bouquet restored from a shared link.");
      });
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const endDrag = useCallback(() => setDragId(null), []);

  const chooseVessel = (kind: VesselKind) => {
    if (kind === vessel) return;
    checkpoint();
    setVessel(kind);
    setVesselColor(getDefaultVesselColor(kind));
    setSelectedId(null);
  };

  const chooseVesselColor = (color: string) => {
    if (color === vesselColor || !getVesselColors(vessel).some((option) => option.color === color)) return;
    checkpoint();
    setVesselColor(color);
  };

  const applyBouquetPreset = (preset: (typeof BOUQUET_PRESETS)[number]) => {
    checkpoint();
    setStems(preset.stems.map((stem, index) => ({
      ...stem,
      id: makeId(),
      x: 0,
      seed: index * 1.73 + 1.2,
    })));
    setVessel(preset.vessel);
    setVesselColor(getDefaultVesselColor(preset.vessel));
    setVesselOpacity(100);
    setBouquetRotation({ ...DEFAULT_BOUQUET_ROTATION });
    setSelectedId(null);
    setHeld(null);
    setLibraryMode("vessels");
    setVesselCategory("imagination");
    setToast(`${preset.name} is ready to reshape.`);
  };

  const placeFlower = useCallback(
    (point: THREE.Vector3, kind = held) => {
      if (!kind) return;
      if (stems.length >= 24) { setToast("Your arrangement holds 24 stems. Remove one to make room."); setHeld(null); return; }
      checkpoint();
      const dx = point.x - 0.72;
      const next: Stem = {
        id: makeId(),
        kind,
        x: 0,
        z: clamp(point.z, -0.25, 0.25),
        height: clamp(point.y - stemInsertionY(vessel), 0.8, 3.2),
        leanX: clamp(dx, -1.7, 1.7),
        leanZ: clamp(point.z - clamp(point.z, -0.25, 0.25), -0.5, 0.5),
        seed: Math.random() * 9,
      };
      setStems((current) => [...current, next].slice(-24));
      setSelectedId(next.id);
      setHeld(null);
    },
    [held, stems.length, checkpoint, vessel],
  );

  const dragFlower = useCallback(
    (id: string, point: THREE.Vector3) => {
      const dx = point.x - 0.72;
      setStems((current) =>
        current.map((stem) =>
          stem.id === id
            ? {
                ...stem,
                height: clamp(point.y - stemInsertionY(vessel), 0.8, 3.2),
                leanX: clamp(dx - stem.x, -1.7, 1.7),
                leanZ: clamp(point.z - stem.z, -0.5, 0.5),
              }
            : stem,
        ),
      );
    },
    [vessel],
  );

  const updateSelectedHeight = (value: number) => {
    if (!selectedId) return;
    setStems((current) =>
      current.map((stem) =>
        stem.id === selectedId
          ? { ...stem, height: value }
          : stem,
      ),
    );
  };

  const updateSelectedAngle = (value: number) => {
    if (!selectedId) return;
    setStems((current) => current.map((stem) => stem.id === selectedId
      ? { ...stem, leanX: value }
      : stem));
  };

  const updateSelectedColor = (variant: string) => {
    if (!selectedStem || selectedStem.colorVariant === variant) return;
    if (!getFlowerColors(selectedStem.kind).some((option) => option.id === variant)) return;
    checkpoint();
    setStems((current) => current.map((stem) => stem.id === selectedStem.id
      ? { ...stem, colorVariant: variant === "natural" ? undefined : variant }
      : stem));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    checkpoint();
    setStems((current) =>
      current.filter((stem) => stem.id !== selectedId),
    );
    setSelectedId(null);
  };

  const startOver = () => {
    checkpoint();
    setStems([]);
    setVessel("classic");
    setVesselColor(getDefaultVesselColor("classic"));
    setVesselOpacity(100);
    setBouquetRotation({ ...DEFAULT_BOUQUET_ROTATION });
    setHeld(null);
    setSelectedId(null);
    setDragId(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.target instanceof HTMLElement && (event.target.matches("input, textarea") || event.target.isContentEditable)) return;
    if (event.key === "Escape") { setHeld(null); setSelectedId(null); setFinishOpen(false); return; }
    if (finishOpen || dragId) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault(); if (event.shiftKey) redo(); else undo();
    }
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); }
  });
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const openFinish = () => {
    if (modelsLoading) { setToast("Some 3D previews are still rendering. Try again in a moment."); return; }
    if (!stems.length) {
      setToast("Add a stem to your arrangement first.");
      return;
    }
    const canvas = document.querySelector(
      ".canvas-wrap canvas",
    ) as HTMLCanvasElement | null;
    setSelectedId(null);
    setHeld(null);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const snapshot = document.createElement("canvas");
      const width = Math.min(canvas?.width ?? 0, 1100);
      const height = canvas?.width ? Math.round((canvas.height / canvas.width) * width) : 0;
      snapshot.width = width;
      snapshot.height = height;
      const context = snapshot.getContext("2d");
      if (context && canvas) {
        context.fillStyle = "#eee9dd";
        context.fillRect(0, 0, width, height);
        context.drawImage(canvas, 0, 0, width, height);
      }
      setFinishImage(context ? snapshot.toDataURL("image/jpeg", 0.84) : null);
      setShareUrl(null);
      setShareError("");
      setFinishOpen(true);
    }));
  };

  const createShareLink = async () => {
    if (!finishImage || publishing) return;
    setPublishing(true);
    setShareError("");
    try {
      const response = await fetch("/api/postcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bouquet: encodeBouquet(stems, bouquetRotation, vessel, vesselColor, vesselOpacity),
          to: recipient,
          message: giftMessage,
          from: sender,
          image: finishImage,
        }),
      });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Could not create a link.");
      setShareUrl(`${window.location.origin}${result.path}`);
    } catch {
      setShareError("Could not save this postcard. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("Postcard link copied.");
    } catch {
      setShareError("Copy failed. Select the link above to copy it manually.");
    }
  };

  const downloadImage = async () => {
    if (!finishImage) {
      setToast("Image is still rendering. Try once more.");
      return;
    }
    try {
      const image = await drawPostcard(finishImage, recipient.trim(), giftMessage.trim(), sender.trim());
      const link = document.createElement("a");
      link.href = image;
      link.download = "bloomroom-postcard.png";
      link.click();
    } catch {
      setToast("Could not draw the postcard. Try again.");
    }
  };

  return (
    <main className="studio">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div className="brand-copy">
            <strong>Bloomroom</strong>
            <span>Digital Flower Studio</span>
          </div>
        </div>

        <div className="top-actions">
          <span className="stem-count" aria-live="polite">{stems.length} / 24 stems</span>
          <button className="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl Z)" disabled={!historyState.undo} onClick={undo}><Undo2 size={15} /></button>
          <button className="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)" disabled={!historyState.redo} onClick={redo}><Redo2 size={15} /></button>
          <button
            className="icon-button"
            type="button"
            aria-label="Start over"
            title="Start over"
            onClick={startOver}
          >
            <RotateCcw size={15} strokeWidth={1.5} />
          </button>
          <button
            className="finish-button"
            disabled={!stems.length}
            type="button"
            onClick={openFinish}
          >
            Finish bouquet
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="Digital flower studio" data-library-mode={libraryMode}>
        <div className="hero-copy">
          <div className="eyebrow">01 · Pick · Place · Feel</div>
          <h1>Arrange in space.</h1>
          <p>
            Click to add a flower in a balanced spot, or drag it for precise placement.
          </p>
        </div>

        <div className="canvas-wrap" style={{ cursor: dragId ? "grabbing" : held ? "crosshair" : "default" }}>
          <Canvas
            shadows
            dpr={[1, 1.5]}
            camera={{
              position: [0, 3.25, 7.4],
              zoom: 1,
              near: 0.1,
              far: 30,
            }}
            orthographic
            gl={{
              antialias: true,
              alpha: true,
              preserveDrawingBuffer: true,
              powerPreference: "high-performance",
            }}
          >
            <StudioScene
              stems={stems}
              lightWarmth={lightWarmth}
              lightDirection={lightDirection}
              wind={wind}
              vessel={vessel}
              vesselColor={vesselColor}
              vesselOpacity={vesselOpacity}
              bouquetRotation={bouquetRotation}
              held={held}
              selectedId={selectedId}
              dragId={dragId}
              onSelect={setSelectedId}
              onDragStart={(id) => { checkpoint(); setDragId(id); }}
              onPlace={placeFlower}
              onDrag={dragFlower}
              onDragEnd={endDrag}
              onRotateStart={checkpoint}
              onRotate={setBouquetRotation}
              projectPointerRef={projectPointerRef}
            />
          </Canvas>
        </div>

        <aside className={libraryMode === "vessels" ? "palette has-vessel-library" : "palette"} aria-label="Flower component library">
          <div className="palette-modes" role="tablist" aria-label="Studio library">
            {([
              ["flowers", "Flowers", "花材"],
              ["vessels", "Containers", "容器"],
            ] as [LibraryMode, string, string][]).map(([mode, label, subtitle]) => (
              <button key={mode} type="button" role="tab" aria-selected={libraryMode === mode}
                className={libraryMode === mode ? "palette-mode active" : "palette-mode"}
                onClick={() => {
                  setLibraryMode(mode);
                  if (mode !== "flowers") setHeld(null);
                }}>
                <span>{label}</span><small>{subtitle}</small>
              </button>
            ))}
          </div>

          <div className="palette-header">
            <div>
              <span className="palette-step">{libraryMode === "flowers" ? "01 / FLOWERS" : "02 / CONTAINERS"}</span>
              <h2>{libraryMode === "flowers" ? "What will you arrange today?" : "Choose a container"}</h2>
              <p>{libraryMode === "flowers" ? "Choose a flower, then place it in your arrangement." : "Choose a vase, wrap, or start from a bouquet."}</p>
            </div>
          </div>

          {libraryMode === "flowers" ? <>
            <div className="category-tabs" role="tablist" aria-label="Flower categories">
              {(Object.keys(CATEGORY_LABELS) as FlowerCategory[]).map((item) => {
                const count = FLOWERS.filter((flower) => flower.category === item && flower.kind !== "blue-poppy").length;
                return <button key={item} type="button" role="tab" aria-selected={category === item}
                  className={category === item ? "category-tab active" : "category-tab"}
                  onClick={() => setCategory(item)}>
                  <span>{CATEGORY_LABELS[item].label}</span><small>{CATEGORY_LABELS[item].subtitle} · {count}</small>
                </button>;
              })}
            </div>
            <div className="flower-grid">
              {FLOWERS.filter((flower) => flower.category === category && flower.kind !== "blue-poppy").map((flower) => (
              <button
                key={flower.kind}
                className={
                  held === flower.kind
                    ? "flower-card is-held"
                    : "flower-card"
                }
                type="button"
                aria-pressed={held === flower.kind}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  suppressClick.current = false;
                  paletteDrag.current = { x: event.clientX, y: event.clientY, moved: false };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const active = paletteDrag.current;
                  if (!active || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  if (!active.moved && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 7) return;
                  active.moved = true;
                  setHeld(flower.kind); setSelectedId(null);
                  projectPointerRef.current?.(event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  const active = paletteDrag.current;
                  paletteDrag.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                  if (!active?.moved) return;
                  suppressClick.current = true;
                  const target = document.elementFromPoint(event.clientX, event.clientY);
                  if (target?.closest(".canvas-wrap")) {
                    const point = projectPointerRef.current?.(event.clientX, event.clientY);
                    if (point) placeFlower(point, flower.kind);
                  } else setHeld(null);
                }}
                onPointerCancel={() => { paletteDrag.current = null; setHeld(null); }}
                onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } placeFlower(autoPlacementPoint(flower.kind, stems.length, vessel), flower.kind); }}
              >
                <FlowerThumbnail kind={flower.kind} />
                <span className="flower-card-plus" aria-hidden="true">+</span>
                <strong>{flower.name}</strong>
                <small>{flower.latin}</small>
                {stems.some((stem) => stem.kind === flower.kind) ? <span className="added-indicator">Added · {stems.filter((stem) => stem.kind === flower.kind).length}</span> : null}
                {flower.availability !== "available" ? (
                  <span
                    className={`availability ${flower.availability}`}
                  >
                    {flower.availability === "play"
                      ? "play only"
                      : "preorder"}
                  </span>
                ) : null}
              </button>
              ))}
            </div>
          </> : null}

          {libraryMode === "vessels" ? <div className="library-scroll vessel-library">
            <div className="vessel-tabs" role="tablist" aria-label="Vessel type">
              <button type="button" role="tab" aria-selected={vesselCategory === "vase"} className={vesselCategory === "vase" ? "vessel-tab active" : "vessel-tab"} onClick={() => setVesselCategory("vase")}>Vases</button>
              <button type="button" role="tab" aria-selected={vesselCategory === "bouquet"} className={vesselCategory === "bouquet" ? "vessel-tab active" : "vessel-tab"} onClick={() => setVesselCategory("bouquet")}>Bouquets</button>
              <button type="button" role="tab" aria-selected={vesselCategory === "imagination"} className={vesselCategory === "imagination" ? "vessel-tab active" : "vessel-tab"} onClick={() => setVesselCategory("imagination")}>Imagination</button>
            </div>
            {vessel !== "naked" ? <div className="vessel-appearance">
              <span className="vessel-appearance-title">Container color</span>
              <div className="color-options" role="group" aria-label="Container color">
                {getVesselColors(vessel).map((option) => <button
                  key={option.color}
                  type="button"
                  className="color-option"
                  style={{ "--petal-color": option.color } as React.CSSProperties}
                  aria-label={option.label}
                  aria-pressed={vesselColor === option.color}
                  title={option.label}
                  onClick={() => chooseVesselColor(option.color)}
                ><span /></button>)}
              </div>
              <label htmlFor="vessel-opacity"><span>Opacity</span><output>{vesselOpacity}%</output></label>
              <input
                id="vessel-opacity"
                className="range"
                type="range"
                min="25"
                max="100"
                step="5"
                value={vesselOpacity}
                aria-label="Container opacity"
                onPointerDown={checkpoint}
                onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) checkpoint(); }}
                onChange={(event) => setVesselOpacity(Number(event.target.value))}
              />
            </div> : null}
            {vesselCategory === "imagination" ? <div className="vessel-options-scroll bouquet-grid">
              {BOUQUET_PRESETS.map((preset) => (
                <button key={preset.id} type="button" className="bouquet-card" onClick={() => applyBouquetPreset(preset)}>
                  <BouquetThumbnail preset={preset} />
                  <span className="bouquet-card-copy"><strong>{preset.name}</strong><small>{preset.note}</small></span>
                  <span className="bouquet-card-count">{preset.stems.length} stems</span>
                </button>
              ))}
            </div> : <div className="vessel-options-scroll vessel-grid">
              {VESSEL_OPTIONS.filter((option) => option.category === vesselCategory).map((option) => (
                <button key={option.kind} type="button" aria-pressed={vessel === option.kind}
                  className={vessel === option.kind ? "vessel-card active" : "vessel-card"}
                  onClick={() => chooseVessel(option.kind)}>
                  <VesselThumbnail
                    option={option}
                    vesselColor={vessel === option.kind ? vesselColor : getDefaultVesselColor(option.kind)}
                    vesselOpacity={vessel === option.kind ? vesselOpacity : 100}
                  />
                  <strong>{option.name}</strong><small>{option.note}</small>
                </button>
              ))}
            </div>}
          </div> : null}
        </aside>

        <aside className="scene-tools" aria-label="Studio controls">
          <div className="tool-section">
            <button type="button" className="adjust-toggle" disabled={!stems.length}
              aria-expanded={!!selectedStem}
              onClick={() => setSelectedId(selectedStem ? null : stems[0].id)}>
              <span>Adjust flowers</span><span>{stems.length}</span>
            </button>
            <p className="rotation-hint">Click a flower to edit its height, angle, and color.</p>
          </div>
          <div className="tool-section">
            <div className="tool-label">
              <span>Morning light</span>
              <Sparkles size={13} strokeWidth={1.4} />
            </div>
            <div className="light-adjustments">
              <label className="light-control" htmlFor="light-warmth">
                <span>Warmth</span><output>{lightWarmth === 0 ? "Balanced" : lightWarmth > 0 ? `+${lightWarmth}` : lightWarmth}</output>
              </label>
              <input id="light-warmth" className="range" type="range" min="-100" max="100" value={lightWarmth}
                aria-label="Light warmth" onChange={(event) => setLightWarmth(Number(event.target.value))} />
              <div className="light-scale"><span>Cool</span><span>Warm</span></div>
              <label className="light-control" htmlFor="light-direction">
                <span>Direction</span><output>{lightDirection}°</output>
              </label>
              <input id="light-direction" className="range" type="range" min="-180" max="180" value={lightDirection}
                aria-label="Light direction" onChange={(event) => setLightDirection(Number(event.target.value))} />
              <div className="light-scale"><span>Turn left</span><span>Turn right</span></div>
            </div>
          </div>

          <div className="tool-section">
            <div className="tool-label">
              <span>Wind</span>
              <Wind size={13} strokeWidth={1.4} />
            </div>
            <input
              className="range"
              type="range"
              min="0"
              max="100"
              value={Math.round(wind * 100)}
              aria-label="Wind strength"
              onChange={(event) =>
                setWind(Number(event.target.value) / 100)
              }
            />
          </div>

          <AmbientSoundPanel />

          <div className="tool-section rotation-section">
            <button
              type="button"
              className="rotation-toggle"
              aria-expanded={rotationOpen}
              aria-controls="bouquet-rotation-controls"
              aria-describedby="bouquet-rotation-hint"
              title="Flowers rotate together with the vase"
              onClick={() => setRotationOpen((open) => !open)}
            >
              <span>Rotate vase</span>
              <RotateCcw size={13} strokeWidth={1.5} />
            </button>
            <p className="rotation-hint" id="bouquet-rotation-hint">Drag vase: left/right turns, up/down tilts. Shift-drag rolls.</p>
            <div id="bouquet-rotation-controls" className="rotation-controls" hidden={!rotationOpen}>
                <div className="rotation-axis">
                  <label htmlFor="bouquet-rotation-x">
                    <span>X · Tilt</span><span>{Math.round(bouquetRotation.x)}°</span>
                  </label>
                  <input
                    id="bouquet-rotation-x"
                    className="range"
                    type="range"
                    min="-35"
                    max="35"
                    step="1"
                    value={bouquetRotation.x}
                    aria-label="Bouquet rotation around X axis"
                    onPointerDown={checkpoint}
                    onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) checkpoint(); }}
                    onChange={(event) => setBouquetRotation((current) => ({ ...current, x: Number(event.target.value) }))}
                  />
                </div>
                <div className="rotation-axis">
                  <label htmlFor="bouquet-rotation-y">
                    <span>Y · Turn</span><span>{Math.round(bouquetRotation.y)}°</span>
                  </label>
                  <input
                    id="bouquet-rotation-y"
                    className="range"
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={bouquetRotation.y}
                    aria-label="Bouquet rotation around Y axis"
                    onPointerDown={checkpoint}
                    onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) checkpoint(); }}
                    onChange={(event) => setBouquetRotation((current) => ({ ...current, y: Number(event.target.value) }))}
                  />
                </div>
                <div className="rotation-axis">
                  <label htmlFor="bouquet-rotation-z">
                    <span>Z · Roll</span><span>{Math.round(bouquetRotation.z)}°</span>
                  </label>
                  <input
                    id="bouquet-rotation-z"
                    className="range"
                    type="range"
                    min="-35"
                    max="35"
                    step="1"
                    value={bouquetRotation.z}
                    aria-label="Bouquet rotation around Z axis"
                    onPointerDown={checkpoint}
                    onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) checkpoint(); }}
                    onChange={(event) => setBouquetRotation((current) => ({ ...current, z: Number(event.target.value) }))}
                  />
                </div>
                <button
                  type="button"
                  className="rotation-reset"
                  onClick={() => {
                    if (bouquetRotation.x || bouquetRotation.y || bouquetRotation.z) {
                      checkpoint();
                      setBouquetRotation({ ...DEFAULT_BOUQUET_ROTATION });
                    }
                  }}
                >
                  Reset rotation
                </button>
            </div>
          </div>
        </aside>

        {selectedStem ? <StemAdjustmentControls
          stem={selectedStem}
          stems={stems}
          colors={selectedColors}
          colorVariant={selectedColorVariant}
          onSelectStem={setSelectedId}
          onStartChange={checkpoint}
          onHeightChange={updateSelectedHeight}
          onAngleChange={updateSelectedAngle}
          onColorChange={updateSelectedColor}
          onRemove={removeSelected}
          onDone={() => setSelectedId(null)}
        /> : null}

        {held ? (
          <div className="hint" role="status">
            {getSpec(held).name} · Place in the room · Esc to cancel
          </div>
        ) : stems.length === 0 ? (
          <div className="hint" role="status">
            Pick a flower or drag one into the room.
          </div>
        ) : null}
      </section>

      {finishOpen ? (
        <div className="finish-overlay" role="dialog" aria-modal="true">
          <div className="finish-card">
            <div
              className="finish-preview"
              style={
                finishImage
                  ? {
                      backgroundImage: `url(${finishImage})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center 38%",
                    }
                  : undefined
              }
            >
              <button
                className="close-finish"
                type="button"
                aria-label="Back to editing"
                onClick={() => setFinishOpen(false)}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
              <div className="finish-preview-caption">
                <span>Bloomroom · A gift of flowers</span>
                {recipient.trim() && <strong>To {recipient.trim()}</strong>}
                <p>{giftMessage.trim() || "May your day bloom in its own way."}</p>
                {sender.trim() && <em>From {sender.trim()}</em>}
              </div>
            </div>

            <div className="finish-copy">
              <div className="eyebrow">A gift of flowers</div>
              <h2>Send your bouquet.</h2>
              <p>Write a note, then make a personal postcard to share.</p>

              <div className="gift-fields">
                <label htmlFor="gift-to">To</label>
                <input id="gift-to" type="text" maxLength={64} placeholder="Someone you love" value={recipient}
                  onChange={(event) => { setRecipient(event.target.value); setShareUrl(null); }} />
                <label htmlFor="gift-message">Message</label>
                <textarea id="gift-message" rows={4} maxLength={240} placeholder="May your day bloom in its own way."
                  value={giftMessage} onChange={(event) => { setGiftMessage(event.target.value); setShareUrl(null); }} />
                <small>{giftMessage.length} / 240</small>
                <label htmlFor="gift-from">From</label>
                <input id="gift-from" type="text" maxLength={64} placeholder="Your name" value={sender}
                  onChange={(event) => { setSender(event.target.value); setShareUrl(null); }} />
              </div>

              {shareUrl && <div className="share-result" aria-live="polite">
                <label htmlFor="postcard-link">Your private postcard link</label>
                <input id="postcard-link" type="text" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
                <button type="button" onClick={copyShareLink}><Copy size={13} /> Copy link</button>
              </div>}
              {shareError && <p className="share-error" role="alert">{shareError}</p>}

              <div className="finish-actions">
                <button type="button" onClick={downloadImage}>
                  <Download size={13} /> Download postcard
                </button>
                <button type="button" className="primary" onClick={createShareLink} disabled={publishing || !finishImage}>
                  {publishing ? "Creating…" : shareUrl ? "Create another link" : "Create share link"}
                </button>
                <button
                  type="button"
                  onClick={() => setFinishOpen(false)}
                >
                  Back to editing
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <a className="model-credits" href="/models/credits.html" target="_blank" rel="noreferrer">3D artists & credits ↗</a>
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
