"use client";

import {
  Canvas,
  ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { ContactShadows, OrthographicCamera, useProgress } from "@react-three/drei";
import {
  Bookmark,
  Check,
  Copy,
  Download,
  LogOut,
  RotateCcw,
  Undo2,
  Redo2,
  Share2,
  SlidersHorizontal,
  Sparkles,
  User as UserIcon,
  Wind,
  X,
} from "lucide-react";
import AuthModal from "./AuthModal";
import GardenModal from "./GardenModal";
import type { SafeUser } from "@/lib/auth";
import {
  useEffectEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { minimumStemHeight } from "../lib/stem-geometry";
import { createNaturalStemCurve, naturalStemRadius, stemAxisRotation, stemAxisTip } from "../lib/stem-shape";
import { ImportedFlower, ImportedStem, IMPORTED_STEMS, flowerHeadHeight, flowerHeadWidth } from "./ImportedFlower";
import { AmbientSoundPanel } from "./AmbientSound";
import { LANGUAGES, backdropName, categoryName, colorName, flowerName, presetName, presetNote, t, vesselName, vesselNote, type Language } from "../lib/translations";

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
  | "monstera"
  | "ranunculus"
  | "narcissus"
  | "dahlia"
  | "amaryllis"
  | "astrantia"
  | "eryngium"
  | "pine-cone";

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
  visualScale?: number;
};

type BouquetRotation = { x: number; y: number; z: number };

export type BackdropKind = "linen" | "limestone" | "charcoal" | "forest";

export const BACKDROP_CONFIG: Record<BackdropKind, {
  color: string;
  wall: string;
  fog: string;
  fill: string;
}> = {
  linen: {
    color: "#EEE9DD",
    wall: "#EEE9DD",
    fog: "#EEE9DD",
    fill: "#D9E0D2",
  },
  limestone: {
    color: "#D6DAD7",
    wall: "#D6DAD7",
    fog: "#D6DAD7",
    fill: "#CFD6D3",
  },
  charcoal: {
    color: "#30322F",
    wall: "#30322F",
    fog: "#30322F",
    fill: "#C8CCC5",
  },
  forest: {
    color: "#344039",
    wall: "#344039",
    fog: "#344039",
    fill: "#C8CCC5",
  },
};

export const BACKDROP_OPTIONS: { id: BackdropKind; color: string }[] = [
  { id: "linen", color: "#EEE9DD" },
  { id: "limestone", color: "#D6DAD7" },
  { id: "charcoal", color: "#30322F" },
  { id: "forest", color: "#344039" },
];

type StudioSnapshot = {
  stems: Stem[];
  rotation: BouquetRotation;
  vessel: VesselKind;
  vesselColor: string;
  vesselOpacity: number;
  vesselScale: number;
  backdrop: BackdropKind;
  lightWarmth: number;
  lightDirection: number;
};

const DEFAULT_BOUQUET_ROTATION: BouquetRotation = { x: 0, y: 0, z: 0 };

// Keep species distinct while making the smaller blooms readable at the default camera distance.
const FLOWER_PRESENTATION: Partial<Record<FlowerKind, { scale?: number; frontTilt?: number }>> = {
  ranunculus: { frontTilt: 0.85 },
  dahlia: { frontTilt: 0.75 },
  astrantia: { frontTilt: 0.55 },
  anemone: { scale: 1.12 },
  chamomile: { scale: 1.1, frontTilt: 1.15 },
  daisy: { scale: 1.06 },
  tulip: { scale: 1.04 },
  rose: { frontTilt: 0.32 },
  carnation: { frontTilt: 0.42 },
  gerbera: { frontTilt: 0.58 },
  poppy: { frontTilt: 0.38 },
  hydrangea: { scale: 0.97 },
  sunflower: { scale: 0.96 },
  delphinium: { scale: 0.55 },
  lotus: { scale: 0.8 },
};

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
    latin: "Anemone",
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
    name: "Ivy sprig",
    latin: "Hedera helix",
    color: "#5a7850",
    center: "#3d5638",
    category: "foliage",
    availability: "available",
    note: "One leafy branching shoot",
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
  {"kind": "ranunculus", "name": "Ranunculus", "latin": "Ranunculus asiaticus", "color": "#f3efe5", "center": "#b59f64", "category": "main", "availability": "available", "note": "One calibrated cut unit"},
  {"kind": "narcissus", "name": "Narcissus", "latin": "Narcissus tazetta", "color": "#f2ebdc", "center": "#b59f64", "category": "main", "availability": "available", "note": "One calibrated cut unit"},
  {"kind": "dahlia", "name": "Dahlia", "latin": "Dahlia × hortensis", "color": "#db8a97", "center": "#b59f64", "category": "main", "availability": "available", "note": "One calibrated cut unit"},
  {"kind": "amaryllis", "name": "Amaryllis", "latin": "Hippeastrum", "color": "#e8a3ad", "center": "#b59f64", "category": "main", "availability": "available", "note": "One calibrated cut unit"},
  {"kind": "astrantia", "name": "Astrantia", "latin": "Astrantia major", "color": "#cc8ca8", "center": "#b59f64", "category": "filler", "availability": "available", "note": "One calibrated cut unit"},
  {"kind": "eryngium", "name": "Sea holly", "latin": "Eryngium", "color": "#97b7c9", "center": "#b59f64", "category": "filler", "availability": "available", "note": "One calibrated cut unit"},
  {"kind": "pine-cone", "name": "Pine cone", "latin": "Pinus", "color": "#69503a", "center": "#b59f64", "category": "foliage", "availability": "available", "note": "One calibrated cut unit"},
];

// Cultivar colors are deliberately curated by species. Foliage stays botanical green.
const FLOWER_COLORS: Partial<Record<FlowerKind, FlowerColorOption[]>> = {
  "ranunculus": [{"id": "natural", "label": "Ivory cream", "color": "#f3efe5"}, {"id": "pink", "label": "Pink", "color": "#dc9cae"}, {"id": "yellow", "label": "Yellow", "color": "#e8cf76"}, {"id": "red", "label": "Red", "color": "#ba4350"}],
  "narcissus": [{"id": "natural", "label": "Ivory cream", "color": "#f2ebdc"}],
  "dahlia": [{"id": "natural", "label": "Pink", "color": "#db8a97"}, {"id": "cream", "label": "White", "color": "#efead9"}, {"id": "orange", "label": "Orange", "color": "#d98a53"}, {"id": "red", "label": "Red", "color": "#a84255"}],
  "amaryllis": [{"id": "natural", "label": "Pink", "color": "#e8a3ad"}, {"id": "cream", "label": "White", "color": "#efe9da"}, {"id": "red", "label": "Red", "color": "#bd3645"}],
  "astrantia": [{"id": "natural", "label": "Pink", "color": "#cc8ca8"}, {"id": "cream", "label": "White", "color": "#e8e7dc"}],
  "eryngium": [{"id": "natural", "label": "Cornflower blue", "color": "#97b7c9"}],
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

const MAX_STEM_ANGLE = 60;
const MAX_STEM_RADIANS = MAX_STEM_ANGLE * Math.PI / 180;

function stemVisualScale(stem: Stem, wrapped = false) {
  return (stem.visualScale ?? 1) * (FLOWER_PRESENTATION[stem.kind]?.scale ?? 1)
    * (wrapped && getSpec(stem.kind).category === "foliage" ? 0.86 : 1);
}

function minimumVisibleStemHeight(kind: FlowerKind, size: number) {
  return Math.max(minimumStemHeight(kind, size), flowerHeadHeight(kind) * size + 0.12);
}

function stemLeanLength(kind: FlowerKind, height: number, size: number) {
  return Math.max(height, minimumVisibleStemHeight(kind, size));
}

function naturalLean(kind: FlowerKind, height: number, leanX: number, leanZ: number, size = 1) {
  const length = stemLeanLength(kind, height, size);
  const z = clamp(leanZ, -length * 0.5, length * 0.5);
  const maximumX = Math.sqrt(Math.max(0, length * length - z * z)) * Math.sin(MAX_STEM_RADIANS);
  return { x: clamp(leanX, -maximumX, maximumX), z };
}

function stemAngleDegrees(stem: Stem, wrapped = false, leanX = stem.leanX) {
  const size = stemVisualScale(stem, wrapped);
  const lean = naturalLean(stem.kind, stem.height, leanX, stem.leanZ, size);
  const length = stemLeanLength(stem.kind, stem.height, size);
  const vertical = Math.sqrt(Math.max(0, length ** 2 - lean.x ** 2 - lean.z ** 2));
  return Math.atan2(lean.x, vertical) * 180 / Math.PI;
}

function stemWithAngle(stem: Stem, degrees: number, wrapped = false): Stem {
  const angle = clamp(degrees, -MAX_STEM_ANGLE, MAX_STEM_ANGLE) * Math.PI / 180;
  const size = stemVisualScale(stem, wrapped);
  const length = stemLeanLength(stem.kind, stem.height, size);
  const z = naturalLean(stem.kind, stem.height, 0, stem.leanZ, size).z;
  return { ...stem, leanX: Math.sqrt(Math.max(0, length ** 2 - z ** 2)) * Math.sin(angle), leanZ: z };
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "zh";
  const supported: Language[] = ["zh", "en", "de", "fr"];
  const queryLanguage = new URLSearchParams(window.location.search).get("lang");
  if (queryLanguage && supported.includes(queryLanguage as Language)) return queryLanguage as Language;
  const saved = window.localStorage.getItem("bloomroom-language");
  if (saved && supported.includes(saved as Language)) return saved as Language;
  const browserLanguage = window.navigator.language.toLowerCase();
  if (browserLanguage.startsWith("de")) return "de";
  if (browserLanguage.startsWith("fr")) return "fr";
  if (browserLanguage.startsWith("en")) return "en";
  return "zh";
}

function getSpec(kind: FlowerKind) {
  return FLOWERS.find((item) => item.kind === kind) ?? FLOWERS[0];
}

const AUTO_PLACEMENT_SLOTS: Record<FlowerCategory, { leanX: number; height: number; z: number }[]> = {
  main: [
    { leanX: 0, height: 2.82, z: 0.08 },
    { leanX: -0.48, height: 2.96, z: 0.02 },
    { leanX: 0.55, height: 2.68, z: 0.13 },
    { leanX: -0.86, height: 2.69, z: -0.03 },
    { leanX: 0.85, height: 2.9, z: 0.04 },
    { leanX: -0.18, height: 2.5, z: 0.17 },
    { leanX: 0.22, height: 3.05, z: -0.08 },
    { leanX: -0.67, height: 2.58, z: 0.09 },
  ],
  filler: [
    { leanX: -0.31, height: 2.48, z: 0.14 },
    { leanX: 0.39, height: 2.57, z: 0.1 },
    { leanX: -0.72, height: 2.72, z: -0.03 },
    { leanX: 0.71, height: 2.39, z: 0.13 },
    { leanX: -0.08, height: 2.95, z: -0.11 },
    { leanX: 0.17, height: 2.31, z: 0.2 },
  ],
  foliage: [
    { leanX: -1.05, height: 2.56, z: -0.14 },
    { leanX: 1.08, height: 2.63, z: -0.17 },
    { leanX: -0.78, height: 2.92, z: -0.19 },
    { leanX: 0.81, height: 2.85, z: -0.16 },
    { leanX: -0.38, height: 2.44, z: -0.11 },
    { leanX: 0.46, height: 2.96, z: -0.18 },
  ],
};

function stemInsertionY(vessel: VesselKind) {
  return vessel === "naked" ? 0.36 : vessel === "paper" || vessel === "canvas" ? 0.58 : 1.43;
}

function isWrappedVessel(vessel: VesselKind) {
  return vessel === "paper" || vessel === "canvas";
}

function wrapLeanBounds(kind: FlowerKind): [number, number] {
  if (kind === "eucalyptus" || kind === "seeded-eucalyptus") return [-0.72, -0.08];
  if (kind === "fern") return [0.02, 0.68];
  if (kind === "ivy") return [0.38, 0.55];
  if (kind === "monstera") return [-0.32, 0.32];
  const category = getSpec(kind).category;
  return category === "foliage" ? [-0.46, 0.46] : category === "filler" ? [-0.58, 0.58] : [-0.72, 0.72];
}

function fitStemToVessel(stem: Stem, vessel: VesselKind): Stem {
  const size = stemVisualScale(stem, isWrappedVessel(vessel));
  const minimumHeight = minimumVisibleStemHeight(stem.kind, size);
  if (stem.height < minimumHeight) stem = stemWithAngle({ ...stem, height: minimumHeight }, stemAngleDegrees(stem, isWrappedVessel(vessel)), isWrappedVessel(vessel));
  if (!isWrappedVessel(vessel)) return stem;
  const [minLean, maxLean] = wrapLeanBounds(stem.kind);
  const category = getSpec(stem.kind).category;
  return {
    ...stem,
    x: stem.kind === "ivy" ? clamp(stem.x, 0.16, 0.21) : clamp(stem.x, -0.06, 0.06),
    z: category === "main" ? clamp(stem.z, -0.18, 0.04) : clamp(stem.z, -0.28, -0.18),
    leanX: clamp(stem.leanX, minLean, maxLean),
    leanZ: clamp(stem.leanZ, -0.22, -0.08),
  };
}

function autoPlacementPoint(kind: FlowerKind, stems: Stem[], vessel: VesselKind, vesselScale = 1) {
  const category = getSpec(kind).category;
  const slots = AUTO_PLACEMENT_SLOTS[category];
  const index = stems.filter((stem) => getSpec(stem.kind).category === category).length;
  const slot = slots[index % slots.length];
  const layer = Math.floor(index / slots.length);
  const spread = isWrappedVessel(vessel) ? 0.58 : 1;
  // The ivy asset branches left from its cut end; give it a near-upright
  // insertion so the source branch does not get tilted a second time.
  if (kind === "delphinium") {
    const spikeIndex = stems.filter((stem) => stem.kind === kind).length;
    return new THREE.Vector3(0.72 + (spikeIndex % 2 ? 0.8 : -0.8) * spread, stemInsertionY(vessel) * vesselScale + 3.05, -0.24);
  }
  const leanX = kind === "ivy" ? -0.18 : slot.leanX + (layer % 2 ? 0.13 : 0);
  return new THREE.Vector3(0.72 + leanX * spread, stemInsertionY(vessel) * vesselScale + slot.height - layer * 0.06, slot.z - layer * 0.04);
}

function FlowerStem({
  stem,
  stemBaseY = 1.43,
  wind,
  selected,
  ghost = false,
  wrapped = false,
  onSelect,
  onDragStart,
}: {
  stem: Stem;
  stemBaseY?: number;
  wind: number;
  selected?: boolean;
  ghost?: boolean;
  wrapped?: boolean;
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
    (!["ranunculus", "narcissus", "amaryllis", "astrantia", "eryngium"].includes(stem.kind) && stem.kind !== "peony" && stem.kind !== "hydrangea" && stem.kind !== "daisy" && stem.kind !== "anemone" && stem.kind !== "chamomile") ||
    (stem.colorVariant && stem.colorVariant !== "natural")
  ) ? bloomColor : undefined;
  const displayHeight = stem.height;
  const visualScale = stemVisualScale(stem, wrapped);
  const headHeight = flowerHeadHeight(stem.kind) * visualScale;
  const headSelectionRadius = Math.max(flowerHeadWidth(stem.kind), flowerHeadHeight(stem.kind)) * visualScale / 2 + 0.08;
  const stalkHeight = Math.max(0.1, displayHeight - headHeight);
  const lean = naturalLean(stem.kind, displayHeight, stem.leanX, stem.leanZ, visualScale);
  const stemLeanQuaternion = stemAxisRotation(displayHeight, lean.x, lean.z);
  const importedTouchPoint = new THREE.Vector3(0, displayHeight * 0.82, 0).applyQuaternion(stemLeanQuaternion);
  const curve = useMemo(
    () => createNaturalStemCurve(stem.kind, stalkHeight, stem.seed),
    [stem.kind, stalkHeight, stem.seed],
  );
  const headAttachmentRotation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), curve.getTangent(1).normalize(),
  ), [curve]);

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
      {stemBaseY > 0.1 && !ghost && <mesh position={[0, -(stemBaseY - 0.1) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, stemBaseY - 0.1, 8]} />
        <meshStandardMaterial color="#617356" roughness={0.82} />
      </mesh>}
      {IMPORTED_STEMS[spec.kind] ? (
        <>
          <group ref={importedVisual} quaternion={stemLeanQuaternion}>
              <ImportedStem kind={spec.kind} ghost={ghost} height={displayHeight} visualScale={visualScale} bloomColor={importedTint} fallback={null} />
          </group>
          {!ghost && <mesh position={importedTouchPoint}>
            <sphereGeometry args={[clamp(displayHeight * 0.15, 0.24, 0.46), 10, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>}
          {selected && !ghost && <mesh ref={importedSelectionRing} visible={false} raycast={() => null}>
            <torusGeometry args={[clamp(displayHeight * visualScale * 0.16, 0.13, 0.4), 0.008, 6, 64]} /><meshBasicMaterial color="#85906d" transparent opacity={0.65} />
          </mesh>}
        </>
      ) : (
        <group quaternion={stemLeanQuaternion}>
          <mesh castShadow>
            <tubeGeometry args={[curve, 28, naturalStemRadius(stem.kind, visualScale), 8, false]} />
            <meshStandardMaterial color="#617356" roughness={0.82} transparent={ghost} opacity={ghost ? 0.38 : 1} />
          </mesh>
          <group position={[tip.x, tip.y, tip.z]}>
            <group quaternion={headAttachmentRotation}>
              <group scale={visualScale} rotation={[FLOWER_PRESENTATION[stem.kind]?.frontTilt ?? 0, 0, 0]}>
                <ImportedFlower kind={spec.kind} ghost={ghost} bloomColor={importedTint} fallback={null} />
              </group>
            </group>
            {selected && !ghost && <mesh position={[0, headHeight / 2, 0.08]}>
              <torusGeometry args={[headSelectionRadius, 0.008, 6, 64]} /><meshBasicMaterial color="#85906d" transparent opacity={0.65} />
            </mesh>}
          </group>
          {!ghost && <mesh position={[tip.x, tip.y + headHeight * 0.48, tip.z]}>
            <sphereGeometry args={[Math.max(headSelectionRadius, 0.27), 10, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>}
        </group>
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
  // Let added blooms broaden the paper more than they raise its rim, so the
  // flower faces remain visible as the bouquet fills out.
  const topHeight = 3.05 + fullness * 0.5;
  const flare = 0.73 + fullness * 0.57;
  for (let i = 0; i <= radialSteps; i++) {
    const angle = -Math.PI + i / radialSteps * Math.PI * 2;
    const front = (1 + Math.cos(angle)) / 2;
    const sideDip = (0.34 + fullness * 0.28) * Math.pow(Math.abs(Math.sin(angle)), 6);
    // A broad, low front opening frames the blooms and foliage instead of
    // hiding them behind a tall paper face. Keep the back high for the wrap silhouette.
    const top = topHeight - (0.9 + fullness * 0.78) * Math.pow(front, 2.3) - sideDip + 0.06 * Math.cos(angle * 3);
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
  const alpha = clamp(vesselOpacity / 100, 0, 1);
  // Keep alpha blending enabled so slider updates do not reuse an opaque shader.
  const alphaProps = { transparent: true, opacity: alpha, depthWrite: alpha === 1 };
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
      <mesh geometry={wrapGeometry} castShadow={alpha === 1} receiveShadow>
        <meshPhysicalMaterial {...alphaProps} color={vesselColor} roughness={0.96} side={THREE.DoubleSide} flatShading />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow={alpha === 1}>
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
      <mesh castShadow={alpha === 1} receiveShadow>
        <latheGeometry args={[points, 48]} />
        <meshPhysicalMaterial {...alphaProps} color={vesselColor} roughness={0.62} metalness={0} clearcoat={0.16} clearcoatRoughness={0.72} />
      </mesh>
      <mesh position={[0, 1.414, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rimRadius, 0.032, 10, 48]} /><meshStandardMaterial {...alphaProps} color={vesselColor} roughness={0.7} />
      </mesh>
      {kind === "mug" && <mesh position={[0.53, 0.78, 0]} scale={[0.74, 0.74, 0.22]}>
        <torusGeometry args={[0.45, 0.085, 10, 32]} /><meshPhysicalMaterial {...alphaProps} color={vesselColor} roughness={0.62} clearcoat={0.16} />
      </mesh>}
    </group>
  );
}

function PreviewCanvas({ className, children }: { className: string; children: React.ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!element.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={element} className={`asset-preview ${className}`} aria-hidden="true">
    {visible && <Canvas
      frameloop="demand"
      dpr={1}
      camera={{ position: [0, 0.65, 5.6], fov: 27, near: 0.1, far: 20 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <hemisphereLight args={["#fffdf6", "#b6ad98", 1.45]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 5]} intensity={1.9} />
      {children}
    </Canvas>}
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
        stem={fitStemToVessel({ id: `wrap-${option.kind}-${index}`, kind, x: (index - (sampleKinds.length - 1) / 2) * 0.08,
          z: (index % 2 ? 1 : -1) * 0.08, height: 2.35 + (index % 2) * 0.18,
          leanX: (index - (sampleKinds.length - 1) / 2) * 0.34, leanZ: index % 2 ? 0.05 : -0.04, seed: index * 1.2 }, option.kind)}
        stemBaseY={stemBaseY}
        wrapped={wrapped}
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
        stem={fitStemToVessel({ ...stem, id: `preset-${preset.id}-${index}`, x: (index - (preset.stems.length - 1) / 2) * 0.055, seed: index * 1.73 + 1.2 }, preset.vessel)}
        stemBaseY={stemBaseY}
        wrapped={wrapped}
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
  language,
  wrapped,
  onSelectStem,
  onStartChange,
  onHeightChange,
  onSizeChange,
  onAngleChange,
  onColorChange,
  onRemove,
  onDone,
}: {
  stem: Stem;
  stems: Stem[];
  colors: FlowerColorOption[];
  colorVariant: string;
  language: Language;
  wrapped: boolean;
  onSelectStem: (id: string) => void;
  onStartChange: () => void;
  onHeightChange: (value: number) => void;
  onSizeChange: (value: number) => void;
  onAngleChange: (value: number) => void;
  onColorChange: (variant: string) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  return <div className="selection-card" aria-label={t(language, "adjust")}>
    <div className="selection-title">
      <div>
        <strong>{flowerName(language, stem.kind)}</strong>
        <div className="selection-meta">{t(language, "adjustHint")}</div>
      </div>
      <button type="button" className="selection-done" aria-label={t(language, "done")} onClick={onDone}><Check size={15} strokeWidth={1.5} /></button>
    </div>
    {stems.length > 1 ? <label className="selection-stem-picker" htmlFor="selected-stem">
      <span>{t(language, "stemToAdjust")}</span>
      <select id="selected-stem" value={stem.id} onChange={(event) => onSelectStem(event.target.value)}>
        {stems.map((item, index) => <option key={item.id} value={item.id}>{String(index + 1).padStart(2, "0")} · {flowerName(language, item.kind)}</option>)}
      </select>
    </label> : null}
    <div className="micro-control">
      <label htmlFor="stem-height"><span>{t(language, "stemHeight")}</span><span>{Math.round(stem.height * 28)} cm</span></label>
      <input onPointerDown={onStartChange} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) onStartChange(); }}
        id="stem-height" className="range" type="range" min={minimumVisibleStemHeight(stem.kind, stemVisualScale(stem, wrapped))} max="3.2" step="0.01" value={stem.height}
        onChange={(event) => onHeightChange(Number(event.target.value))} />
    </div>
    <div className="micro-control">
      <label htmlFor="stem-visual-size"><span>{getSpec(stem.kind).category === "foliage" ? t(language, "leafSize") : t(language, "flowerSize")}</span><span>{Math.round((stem.visualScale ?? 1) * 100)}%</span></label>
      <input onPointerDown={onStartChange} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) onStartChange(); }}
        id="stem-visual-size" className="range" type="range" min="75" max="125" step="1" value={Math.round((stem.visualScale ?? 1) * 100)}
        onChange={(event) => onSizeChange(Number(event.target.value) / 100)} />
    </div>
    <div className="micro-control">
      <label htmlFor="stem-angle"><span>{t(language, "lean")}</span><span>{Math.round(stemAngleDegrees(stem, wrapped))}°</span></label>
      <input onPointerDown={onStartChange} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) onStartChange(); }}
        id="stem-angle" className="range" type="range" min={wrapped ? Math.ceil(stemAngleDegrees(stem, true, wrapLeanBounds(stem.kind)[0])) : -MAX_STEM_ANGLE} max={wrapped ? Math.floor(stemAngleDegrees(stem, true, wrapLeanBounds(stem.kind)[1])) : MAX_STEM_ANGLE} step="1" value={Math.round(stemAngleDegrees(stem, wrapped))}
        onChange={(event) => onAngleChange(Number(event.target.value))} />
    </div>
    {colors.length > 0 ? <div className="micro-control color-control">
      <span className="color-label">{t(language, "flowerColor")}</span>
      <div className="color-options" role="group" aria-label={t(language, "flowerColor")}>
        {colors.map((option) => <button key={option.id} type="button" className="color-option"
          style={{ "--petal-color": option.color } as React.CSSProperties}
          aria-label={colorName(language, option.label)} aria-pressed={colorVariant === option.id} title={colorName(language, option.label)}
          onClick={() => onColorChange(option.id)}><span /></button>)}
      </div>
    </div> : null}
    <button type="button" className="remove-button" onClick={onRemove}>{t(language, "removeStem")}</button>
  </div>;
}

function CameraRig({ bouquetRef, dragging }: { bouquetRef: React.RefObject<THREE.Group | null>; dragging: boolean }) {
  const { size } = useThree();
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  const bounds = useMemo(() => new THREE.Box3(), []);
  const defaultZoom = size.height / (size.width <= 760 ? 6.8 : 7.8);
  useFrame((_, delta) => {
    if (!cameraRef.current || dragging) return;
    let targetZoom = defaultZoom;
    if (size.width <= 760 && bouquetRef.current) {
      bounds.setFromObject(bouquetRef.current);
      if (!bounds.isEmpty()) {
        const halfWidth = Math.max(Math.abs(bounds.min.x - 0.72), Math.abs(bounds.max.x - 0.72));
        targetZoom = Math.min(defaultZoom, (size.width - 32) / (halfWidth * 2 + 0.4));
      }
    }
    const nextZoom = THREE.MathUtils.damp(cameraRef.current.zoom, targetZoom, 10, delta);
    if (Math.abs(nextZoom - cameraRef.current.zoom) > 0.001) {
      cameraRef.current.zoom = nextZoom;
      cameraRef.current.updateProjectionMatrix();
    }
  });
  return <OrthographicCamera
    ref={cameraRef}
    makeDefault
    position={[0.72, 3.65, 12]}
    rotation={[-Math.atan2(0.75, 12), 0, 0]}
    zoom={defaultZoom}
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
  vesselScale,
  bouquetRotation,
  backdrop,
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
  captureSceneRef,
}: {
  stems: Stem[];
  lightWarmth: number;
  lightDirection: number;
  wind: number;
  vessel: VesselKind;
  vesselColor: string;
  vesselOpacity: number;
  vesselScale: number;
  bouquetRotation: BouquetRotation;
  backdrop: BackdropKind;
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
  captureSceneRef: React.RefObject<((highRes?: boolean) => string) | null>;
}) {
  const bouquetGroupRef = useRef<THREE.Group>(null);
  const wrapped = vessel === "paper" || vessel === "canvas";
  const stemBaseY = stemInsertionY(vessel) * vesselScale;
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverPoint, setHoverPoint] = useState(
    () => new THREE.Vector3(0.72, 3.7, 0),
  );

  const { camera, gl, scene } = useThree();
  const backdropConfig = BACKDROP_CONFIG[backdrop] ?? BACKDROP_CONFIG.linen;
  useEffect(() => {
    scene.background = new THREE.Color(backdropConfig.color);
  }, [scene, backdropConfig.color]);
  useEffect(() => {
    captureSceneRef.current = (highRes?: boolean) => {
      if (highRes) {
        const prevRatio = gl.getPixelRatio();
        const prevSize = new THREE.Vector2();
        gl.getSize(prevSize);
        const targetWidth = 1920;
        const targetRatio = Math.min(Math.max(prevRatio, targetWidth / Math.max(prevSize.x, 1)), 4);
        gl.setPixelRatio(targetRatio);
        gl.render(scene, camera);
        const data = gl.domElement.toDataURL("image/png");
        gl.setPixelRatio(prevRatio);
        gl.setSize(prevSize.x, prevSize.y, false);
        gl.render(scene, camera);
        return data;
      }
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    };
    return () => { captureSceneRef.current = null; };
  }, [camera, gl, scene, captureSceneRef]);
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
    const lean = naturalLean(stem.kind, stem.height, stem.leanX, stem.leanZ, stemVisualScale(stem, wrapped));
    const localTip = stemAxisTip(stem.height, lean.x, lean.z).add(new THREE.Vector3(stem.x, stemBaseY, stem.z));
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

  const sceneColors = { fog: backdropConfig.fog, wall: backdropConfig.wall, key: "#fff4db", fill: backdropConfig.fill };
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
      <CameraRig bouquetRef={bouquetGroupRef} dragging={Boolean(dragId)} />
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
        <group scale={vesselScale}><Vase key={vessel} kind={vessel} vesselColor={vesselColor} vesselOpacity={vesselOpacity} flowerCount={stems.length} /></group>
        {stems.map((stem) => (
          <FlowerStem
            key={stem.id}
            stem={stem}
            stemBaseY={stemBaseY}
            wrapped={wrapped}
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

function createBouquetData(
  stems: Stem[],
  rotation: BouquetRotation,
  vessel: VesselKind,
  vesselColor: string,
  vesselOpacity: number,
  vesselScale: number,
  backdrop: BackdropKind = "linen",
  lightWarmth: number = 0,
  lightDirection: number = DEFAULT_LIGHT_DIRECTION,
  wind: number = 0.32,
  sound?: string,
) {
  const compact = stems.map(({ kind, x, z, height, leanX, leanZ, seed, colorVariant, visualScale }) => ({
    kind,
    x,
    z,
    height,
    leanX,
    leanZ,
    seed,
    colorVariant,
    visualScale,
  }));
  return {
    version: 2,
    stems: compact,
    rotation,
    vessel,
    vesselColor,
    vesselOpacity,
    vesselScale,
    backdrop,
    lightWarmth,
    lightDirection,
    wind,
    sound,
  };
}

function encodeBouquet(
  stems: Stem[],
  rotation: BouquetRotation,
  vessel: VesselKind,
  vesselColor: string,
  vesselOpacity: number,
  vesselScale: number,
  backdrop: BackdropKind = "linen",
  lightWarmth: number = 0,
  lightDirection: number = DEFAULT_LIGHT_DIRECTION,
  wind: number = 0.32,
  sound?: string,
) {
  const obj = createBouquetData(
    stems,
    rotation,
    vessel,
    vesselColor,
    vesselOpacity,
    vesselScale,
    backdrop,
    lightWarmth,
    lightDirection,
    wind,
    sound,
  );
  const raw = encodeURIComponent(JSON.stringify(obj));
  return btoa(raw)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBouquet(value: string): {
  stems: Stem[];
  rotation: BouquetRotation;
  vessel: VesselKind;
  vesselColor: string;
  vesselOpacity: number;
  vesselScale: number;
  backdrop: BackdropKind;
  lightWarmth: number;
  lightDirection: number;
  wind?: number;
  sound?: string;
} | null {
  try {
    let normalized = value
      .replaceAll("-", "+")
      .replaceAll("_", "/");
    while (normalized.length % 4) normalized += "=";
    const decoded = decodeURIComponent(atob(normalized));
    const parsed = JSON.parse(decoded) as unknown;
    const shared = Array.isArray(parsed)
      ? { stems: parsed, rotation: DEFAULT_BOUQUET_ROTATION, vessel: "classic" as VesselKind }
      : parsed as {
          stems?: unknown;
          rotation?: Partial<BouquetRotation>;
          vessel?: unknown;
          vesselColor?: unknown;
          vesselOpacity?: unknown;
          vesselScale?: unknown;
          backdrop?: unknown;
          lightWarmth?: unknown;
          lightDirection?: unknown;
          wind?: unknown;
          sound?: unknown;
        } | null;
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
      ? clamp(shared.vesselOpacity, 0, 100)
      : 100;
    const backdrop = shared && typeof shared.backdrop === "string" && BACKDROP_OPTIONS.some((option) => option.id === shared.backdrop)
      ? (shared.backdrop as BackdropKind)
      : "linen";
    const lightWarmth = shared && typeof shared.lightWarmth === "number" && Number.isFinite(shared.lightWarmth)
      ? clamp(shared.lightWarmth, -100, 100)
      : 0;
    const lightDirection = shared && typeof shared.lightDirection === "number" && Number.isFinite(shared.lightDirection)
      ? clamp(shared.lightDirection, -180, 180)
      : DEFAULT_LIGHT_DIRECTION;
    const wind = shared && typeof shared.wind === "number" && Number.isFinite(shared.wind)
      ? clamp(shared.wind, 0, 1)
      : 0.32;
    const sound = shared && typeof shared.sound === "string" ? shared.sound : undefined;

    if (!Array.isArray(parsedStems)
      || ![rotation.x, rotation.y, rotation.z].every((val) => typeof val === "number" && Number.isFinite(val))
      || parsedStems.some((stem) => !stem || !FLOWERS.some((flower) => flower.kind === stem.kind)
      || ![stem.x, stem.z, stem.height, stem.leanX, stem.leanZ, stem.seed].every((val) => typeof val === "number" && Number.isFinite(val))
      || (stem.colorVariant !== undefined && (typeof stem.colorVariant !== "string" || !getFlowerColors(stem.kind).some((option) => option.id === stem.colorVariant)))
      || (stem.visualScale !== undefined && (typeof stem.visualScale !== "number" || !Number.isFinite(stem.visualScale))))) return null;
    return {
      stems: parsedStems.slice(0, 24).map((stem) => fitStemToVessel({
        ...stem,
        x: clamp(stem.x, -0.3, 0.3), z: clamp(stem.z, -0.3, 0.3),
        height: clamp(stem.height, 0.8, 3.2), leanX: clamp(stem.leanX, -3.2 * Math.tan(MAX_STEM_RADIANS), 3.2 * Math.tan(MAX_STEM_RADIANS)), leanZ: clamp(stem.leanZ, -0.5, 0.5),
        visualScale: clamp(stem.visualScale ?? 1, 0.75, 1.25),
        id: makeId(),
      }, vessel)),
      rotation: {
        x: clamp(rotation.x ?? 0, -35, 35),
        y: clamp(rotation.y ?? 0, -180, 180),
        z: clamp(rotation.z ?? 0, -35, 35),
      },
      vessel,
      vesselColor,
      vesselOpacity,
      vesselScale: shared && typeof shared.vesselScale === "number" && Number.isFinite(shared.vesselScale) ? clamp(shared.vesselScale, 0.7, 1.3) : 1,
      backdrop,
      lightWarmth,
      lightDirection,
      wind,
      sound,
    };
  } catch {
    return null;
  }
}

function parseBouquetData(value: string | Record<string, unknown>) {
  if (typeof value === "string") return decodeBouquet(value);
  try {
    const raw = encodeURIComponent(JSON.stringify(value));
    const base64 = btoa(raw).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    return decodeBouquet(base64);
  } catch {
    return null;
  }
}

const POSTCARD_SITE_URL = "https://flower.fde.fan";

async function drawPostcard(imageUrl: string, to: string, message: string, from: string, defaultMessage: string, backdropColor: string = "#EEE9DD") {
  const photo = new Image();
  photo.src = imageUrl;
  await photo.decode();

  // High-resolution scale: 2x (2000 × 3080 px for ultra-crisp display, saving, and printing)
  const SCALE = 2;
  const card = document.createElement("canvas");
  card.width = 1000 * SCALE;
  card.height = 1540 * SCALE;
  const context = card.getContext("2d");
  if (!context) throw new Error("Could not draw the postcard");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  // Card background
  context.fillStyle = "#f9f7f0";
  context.fillRect(0, 0, card.width, card.height);

  // Photo frame background
  context.fillStyle = backdropColor;
  context.fillRect(42 * SCALE, 42 * SCALE, 916 * SCALE, 930 * SCALE);

  // High-res photo positioning
  const scale = Math.min((916 * SCALE) / photo.width, (930 * SCALE) / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;
  context.drawImage(
    photo,
    42 * SCALE + (916 * SCALE - width) / 2,
    42 * SCALE + (930 * SCALE - height) / 2,
    width,
    height,
  );

  // Inner frame border
  context.strokeStyle = "rgba(0, 0, 0, 0.08)";
  context.lineWidth = 1 * SCALE;
  context.strokeRect(41.5 * SCALE, 41.5 * SCALE, 917 * SCALE, 931 * SCALE);

  // Brand header text
  context.fillStyle = "#817d72";
  context.font = `${18 * SCALE}px Arial, sans-serif`;
  context.fillText("BLOOMROOM  ·  A GIFT OF FLOWERS", 72 * SCALE, 1022 * SCALE);

  // Recipient line
  context.fillStyle = "#24251f";
  context.font = `${24 * SCALE}px Arial, sans-serif`;
  if (to) context.fillText(`To ${to},`, 72 * SCALE, 1080 * SCALE);

  // Message typography with dynamic font size stepping
  let lines: string[] = [];
  let baseFontSize = 31;
  for (; baseFontSize >= 17; baseFontSize--) {
    const curFontPx = baseFontSize * SCALE;
    context.font = `${curFontPx}px Georgia, serif`;
    lines = [];
    let line = "";
    for (const character of Array.from(message || defaultMessage)) {
      if (character === "\n") { lines.push(line); line = ""; continue; }
      if (context.measureText(line + character).width > (850 * SCALE) && line) {
        lines.push(line);
        line = character;
      } else {
        line += character;
      }
    }
    if (line) lines.push(line);
    if (lines.length * curFontPx * 1.35 <= (220 * SCALE)) break;
  }
  const finalFontPx = baseFontSize * SCALE;
  context.font = `${finalFontPx}px Georgia, serif`;
  lines.forEach((item, index) => {
    context.fillText(item, 72 * SCALE, 1130 * SCALE + index * finalFontPx * 1.35);
  });

  // Sender line
  if (from) {
    context.font = `${24 * SCALE}px Arial, sans-serif`;
    context.fillText(`From ${from}`, 72 * SCALE, 1360 * SCALE);
  }

  // Divider line
  context.strokeStyle = "#d8d1c3";
  context.lineWidth = 1 * SCALE;
  context.beginPath();
  context.moveTo(72 * SCALE, 1412 * SCALE);
  context.lineTo(738 * SCALE, 1412 * SCALE);
  context.stroke();

  // Footer "SCAN TO OPEN"
  context.fillStyle = "#817d72";
  context.font = `${14 * SCALE}px Arial, sans-serif`;
  context.fillText("SCAN TO OPEN", 72 * SCALE, 1452 * SCALE);

  // Footer domain
  context.fillStyle = "#24251f";
  context.font = `${19 * SCALE}px Arial, sans-serif`;
  context.fillText("flower.fde.fan", 72 * SCALE, 1484 * SCALE);

  // High-res QR code
  const qr = document.createElement("canvas");
  const { default: QRCode } = await import("qrcode");
  await QRCode.toCanvas(qr, POSTCARD_SITE_URL, {
    errorCorrectionLevel: "Q",
    width: 156 * SCALE,
    margin: 4,
    color: { dark: "#24251f", light: "#ffffff" },
  });
  context.drawImage(qr, 772 * SCALE, 1338 * SCALE, 156 * SCALE, 156 * SCALE);
  return card.toDataURL("image/png");
}

export default function FlowerStudio() {
  const modelsLoading = useProgress((state) => state.active);
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [stems, setStems] = useState<Stem[]>([]);
  const [vessel, setVessel] = useState<VesselKind>("classic");
  const [vesselColor, setVesselColor] = useState(getDefaultVesselColor("classic"));
  const [vesselOpacity, setVesselOpacity] = useState(100);
  const [vesselScale, setVesselScale] = useState(1);
  const [vesselAdjustOpen, setVesselAdjustOpen] = useState(false);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("flowers");
  const [vesselCategory, setVesselCategory] = useState<"vase" | "bouquet" | "imagination">("vase");
  const [held, setHeld] = useState<FlowerKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [lightWarmth, setLightWarmth] = useState(0);
  const [lightDirection, setLightDirection] = useState(DEFAULT_LIGHT_DIRECTION);
  const [backdrop, setBackdrop] = useState<BackdropKind>("linen");
  const [category, setCategory] = useState<FlowerCategory>("main");
  const [wind, setWind] = useState(0.32);
  const [bouquetRotation, setBouquetRotation] = useState<BouquetRotation>({ ...DEFAULT_BOUQUET_ROTATION });
  const [rotationOpen, setRotationOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishImage, setFinishImage] = useState<string | null>(null);
  const [highResImage, setHighResImage] = useState<string | null>(null);
  const [postcardRender, setPostcardRender] = useState<{ source: string; to: string; message: string; from: string; image: string } | null>(null);
  const [mobilePostcardOpen, setMobilePostcardOpen] = useState(false);
  const [mobileSave, setMobileSave] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [sender, setSender] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPromptReason, setAuthPromptReason] = useState("");
  const [gardenModalOpen, setGardenModalOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftVersion, setActiveDraftVersion] = useState<number>(1);
  const [activeDraftTitle, setActiveDraftTitle] = useState<string>("");
  const postcardImage = postcardRender?.source === finishImage
    && postcardRender.to === recipient.trim()
    && postcardRender.message === giftMessage.trim()
    && postcardRender.from === sender.trim()
    ? postcardRender.image : null;
  const past = useRef<StudioSnapshot[]>([]);
  const future = useRef<StudioSnapshot[]>([]);
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const projectPointerRef = useRef<((x: number, y: number) => THREE.Vector3 | null) | null>(null);
  const captureSceneRef = useRef<((highRes?: boolean) => string) | null>(null);
  const finishOverlayRef = useRef<HTMLDivElement>(null);
  const paletteDrag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => { window.localStorage.setItem("bloomroom-language", language); }, [language]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px), (pointer: coarse)");
    const update = () => setMobileSave(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!finishOpen || !finishImage) return;
    let cancelled = false;
    const to = recipient.trim();
    const message = giftMessage.trim();
    const from = sender.trim();
    const backdropColor = BACKDROP_CONFIG[backdrop]?.color ?? "#EEE9DD";
    const renderSource = highResImage || finishImage;
    drawPostcard(renderSource, to, message, from, t(language, "defaultMessage"), backdropColor)
      .then((image) => { if (!cancelled) setPostcardRender({ source: finishImage, to, message, from, image }); })
      .catch(() => { if (!cancelled) setToast(t(language, "drawError")); });
    return () => { cancelled = true; };
  }, [finishOpen, finishImage, highResImage, recipient, giftMessage, sender, language, backdrop]);
  const changeLanguage = (next: Language) => {
    setLanguage(next);
    window.localStorage.setItem("bloomroom-language", next);
  };
  const checkpoint = useCallback(() => {
    past.current = [...past.current.slice(-39), { stems, rotation: bouquetRotation, vessel, vesselColor, vesselOpacity, vesselScale, backdrop, lightWarmth, lightDirection }];
    future.current = [];
    setHistoryState({ undo: past.current.length, redo: future.current.length });
  }, [bouquetRotation, stems, vessel, vesselColor, vesselOpacity, vesselScale, backdrop, lightWarmth, lightDirection]);
  const undo = () => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push({ stems, rotation: bouquetRotation, vessel, vesselColor, vesselOpacity, vesselScale, backdrop, lightWarmth, lightDirection });
    setStems(previous.stems);
    setBouquetRotation(previous.rotation);
    setVessel(previous.vessel);
    setVesselColor(previous.vesselColor);
    setVesselOpacity(previous.vesselOpacity);
    setVesselScale(previous.vesselScale);
    if (previous.backdrop) setBackdrop(previous.backdrop);
    if (previous.lightWarmth !== undefined) setLightWarmth(previous.lightWarmth);
    if (previous.lightDirection !== undefined) setLightDirection(previous.lightDirection);
    setSelectedId(null); setHeld(null); setHistoryState({ undo: past.current.length, redo: future.current.length });
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ stems, rotation: bouquetRotation, vessel, vesselColor, vesselOpacity, vesselScale, backdrop, lightWarmth, lightDirection });
    setStems(next.stems);
    setBouquetRotation(next.rotation);
    setVessel(next.vessel);
    setVesselColor(next.vesselColor);
    setVesselOpacity(next.vesselOpacity);
    setVesselScale(next.vesselScale);
    if (next.backdrop) setBackdrop(next.backdrop);
    if (next.lightWarmth !== undefined) setLightWarmth(next.lightWarmth);
    if (next.lightDirection !== undefined) setLightDirection(next.lightDirection);
    setSelectedId(null); setHeld(null); setHistoryState({ undo: past.current.length, redo: future.current.length });
  };

  const selectedStem = stems.find((stem) => stem.id === selectedId) ?? null;
  const selectedColors = selectedStem ? getFlowerColors(selectedStem.kind) : [];
  const selectedColorVariant = selectedStem?.colorVariant ?? "natural";

  useEffect(() => {
    const handleRestore = () => {
      const value = window.location.hash.startsWith("#b=")
        ? window.location.hash.slice(3)
        : "";
      if (!value) return;
      const restored = decodeBouquet(value);
      if (restored?.stems.length) {
        const queryLanguage = new URLSearchParams(window.location.search).get("lang");
        const savedLanguage = window.localStorage.getItem("bloomroom-language");
        const restoredLanguage = ["zh", "en", "de", "fr"].includes(queryLanguage ?? "")
          ? queryLanguage as Language
          : ["zh", "en", "de", "fr"].includes(savedLanguage ?? "") ? savedLanguage as Language : "zh";
        queueMicrotask(() => {
          setStems(restored.stems);
          setBouquetRotation(restored.rotation);
          setVessel(restored.vessel);
          setVesselColor(restored.vesselColor);
          setVesselOpacity(restored.vesselOpacity);
          setVesselScale(restored.vesselScale);
          setBackdrop(restored.backdrop);
          setLightWarmth(restored.lightWarmth);
          setLightDirection(restored.lightDirection);
          setToast(t(restoredLanguage, "restored"));
        });
      }
    };
    handleRestore();
    window.addEventListener("hashchange", handleRestore);
    return () => window.removeEventListener("hashchange", handleRestore);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!finishOpen || !window.matchMedia("(max-width: 760px)").matches) return;
    const overlay = finishOverlayRef.current;
    const viewport = window.visualViewport;
    if (!overlay || !viewport) return;
    const update = () => {
      overlay.style.setProperty("--visible-height", `${viewport.height}px`);
      overlay.style.setProperty("--visible-top", `${viewport.offsetTop}px`);
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && overlay.contains(focused) && focused.matches("input, textarea")) {
        focused.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, [finishOpen]);

  const endDrag = useCallback(() => setDragId(null), []);

  const chooseVessel = (kind: VesselKind) => {
    if (kind === vessel) return;
    checkpoint();
    setVessel(kind);
    if (isWrappedVessel(kind)) setStems((current) => current.map((stem) => fitStemToVessel(stem, kind)));
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
    setStems(preset.stems.map((stem, index) => fitStemToVessel({
      ...stem,
      id: makeId(),
      x: 0,
      seed: index * 1.73 + 1.2,
    }, preset.vessel)));
    setVessel(preset.vessel);
    setVesselColor(getDefaultVesselColor(preset.vessel));
    setVesselOpacity(100);
    setVesselScale(1);
    setBouquetRotation({ ...DEFAULT_BOUQUET_ROTATION });
    setSelectedId(null);
    setHeld(null);
    setLibraryMode("vessels");
    setVesselCategory("imagination");
    setToast(`${presetName(language, preset.id as "first-light" | "meadow-air" | "cloud-study")} · ${t(language, "adjust")}`);
  };

  const placeFlower = useCallback(
    (point: THREE.Vector3, kind = held) => {
      if (!kind) return;
      if (stems.length >= 24) { setToast(t(language, "full")); setHeld(null); return; }
      checkpoint();
      const dx = point.x - 0.72;
      const height = clamp(point.y - stemInsertionY(vessel) * vesselScale, 0.8, 3.2);
      const z = clamp(point.z, -0.25, 0.25);
      const lean = naturalLean(kind, height, clamp(dx, -1.7, 1.7), clamp(point.z - z, -0.5, 0.5));
      const next = fitStemToVessel({
        id: makeId(),
        kind,
        x: 0,
        z,
        height,
        leanX: lean.x,
        leanZ: lean.z,
        seed: Math.random() * 9,
      }, vessel);
      setStems((current) => [...current, next].slice(-24));
      if (window.matchMedia("(max-width: 760px)").matches) {
        setSelectedId(null);
        setToast(t(language, "tapToAdjust"));
      } else {
        setSelectedId(next.id);
      }
      setMobileToolsOpen(false);
      setHeld(null);
    },
    [held, stems.length, checkpoint, vessel, vesselScale, language],
  );

  const dragFlower = useCallback(
    (id: string, point: THREE.Vector3) => {
      const dx = point.x - 0.72;
      setStems((current) =>
        current.map((stem) =>
          stem.id === id ? (() => {
            const size = stemVisualScale(stem, isWrappedVessel(vessel));
            const x = dx - stem.x;
            const z = clamp(point.z - stem.z, -0.5, 0.5);
            const vertical = Math.max(0.05, point.y - stemInsertionY(vessel) * vesselScale);
            const height = clamp(Math.hypot(x, vertical, z), 0.8, 3.2);
            const lean = naturalLean(stem.kind, height, x, z, size);
            return fitStemToVessel({ ...stem, height, leanX: lean.x, leanZ: lean.z }, vessel);
          })() : stem,
        ),
      );
    },
    [vessel, vesselScale],
  );

  const updateSelectedHeight = (value: number) => {
    if (!selectedId) return;
    setStems((current) => current.map((stem) => stem.id === selectedId
      ? fitStemToVessel(stemWithAngle({ ...stem, height: value }, stemAngleDegrees(stem, isWrappedVessel(vessel)), isWrappedVessel(vessel)), vessel)
      : stem));
  };

  const updateSelectedSize = (value: number) => {
    if (!selectedId) return;
    setStems((current) => current.map((stem) => stem.id === selectedId
      ? fitStemToVessel(stemWithAngle({ ...stem, visualScale: clamp(value, 0.75, 1.25) }, stemAngleDegrees(stem, isWrappedVessel(vessel)), isWrappedVessel(vessel)), vessel)
      : stem));
  };

  const updateSelectedAngle = (value: number) => {
    if (!selectedId) return;
    setStems((current) => current.map((stem) => stem.id === selectedId
      ? fitStemToVessel(stemWithAngle(stem, value, isWrappedVessel(vessel)), vessel)
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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const onAuthSuccess = async (newUser: SafeUser) => {
    setUser(newUser);
    setToast(t(language, "loginSuccess"));

    try {
      const pendingRaw = window.localStorage.getItem("bloomroom_pending_draft");
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);
        if (!pending.ownerUserId || pending.ownerUserId === newUser.id) {
          setSavingDraft(true);
          const res = await fetch("/api/user/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: pending.title || t(language, "untitledBouquet"),
              bouquet_data: pending.bouquetData,
              preview_image: pending.previewImage,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setActiveDraftId(data.draft.id);
            setActiveDraftVersion(data.draft.version);
            setActiveDraftTitle(data.draft.title);
            window.localStorage.removeItem("bloomroom_pending_draft");
            setToast(t(language, "draftSaved"));
          }
        }
      }
    } catch {
      // Ignored
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignored
    }
    setUser(null);
    setActiveDraftId(null);
    setActiveDraftVersion(1);
    setActiveDraftTitle("");
    setToast(t(language, "logoutSuccess"));
  };

  const handleSaveDraft = async () => {
    if (!stems.length) {
      setToast(t(language, "addFirst"));
      return;
    }
    if (savingDraft) return;

    setSavingDraft(true);
    let previewUrl: string | null = null;
    try {
      const source = captureSceneRef.current?.(false);
      if (source) {
        const photo = new Image();
        photo.src = source;
        await photo.decode();
        const canvas = document.createElement("canvas");
        const w = 480;
        const h = Math.round((photo.height / photo.width) * w);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = BACKDROP_CONFIG[backdrop]?.color ?? "#EEE9DD";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(photo, 0, 0, w, h);
          previewUrl = canvas.toDataURL("image/jpeg", 0.75);
        }
      }
    } catch {
      previewUrl = null;
    }

    const bouquetData = createBouquetData(
      stems,
      bouquetRotation,
      vessel,
      vesselColor,
      vesselOpacity,
      vesselScale,
      backdrop,
      lightWarmth,
      lightDirection,
      wind,
    );

    const draftTitle = activeDraftTitle || `${flowerName(language, stems[0].kind)} · ${t(language, "myGarden")}`;

    try {
      window.localStorage.setItem(
        "bloomroom_pending_draft",
        JSON.stringify({
          draftId: activeDraftId,
          title: draftTitle,
          bouquetData,
          previewImage: previewUrl,
          serverVersion: activeDraftVersion,
          localVersion: Date.now(),
          ownerUserId: user?.id ?? null,
          savedAt: Date.now(),
        }),
      );
    } catch {
      setToast("本地存储空间不足，建议直接登录同步至云端。");
    }

    if (!user) {
      setSavingDraft(false);
      setAuthPromptReason(t(language, "loginToSaveHint"));
      setAuthModalOpen(true);
      return;
    }

    try {
      if (activeDraftId) {
        const res = await fetch(`/api/user/drafts/${activeDraftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draftTitle,
            bouquet_data: bouquetData,
            preview_image: previewUrl,
            version: activeDraftVersion,
          }),
        });

        if (res.status === 409) {
          const copyRes = await fetch("/api/user/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: `${draftTitle} (副本)`,
              bouquet_data: bouquetData,
              preview_image: previewUrl,
            }),
          });
          if (copyRes.ok) {
            const copyData = await copyRes.json();
            setActiveDraftId(copyData.draft.id);
            setActiveDraftVersion(copyData.draft.version);
            setActiveDraftTitle(copyData.draft.title);
            window.localStorage.removeItem("bloomroom_pending_draft");
            setToast(t(language, "conflictNotice"));
          }
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setActiveDraftVersion(data.draft.version);
          setActiveDraftTitle(data.draft.title);
          window.localStorage.removeItem("bloomroom_pending_draft");
          setToast(t(language, "draftUpdated"));
          return;
        }
      }

      const createRes = await fetch("/api/user/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          bouquet_data: bouquetData,
          preview_image: previewUrl,
        }),
      });

      if (createRes.ok) {
        const data = await createRes.json();
        setActiveDraftId(data.draft.id);
        setActiveDraftVersion(data.draft.version);
        setActiveDraftTitle(data.draft.title);
        window.localStorage.removeItem("bloomroom_pending_draft");
        setToast(t(language, "draftSaved"));
      } else {
        throw new Error("Failed to save draft");
      }
    } catch {
      setToast(t(language, "savingError"));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadDraft = async (draftId: string) => {
    try {
      const res = await fetch(`/api/user/drafts/${draftId}`);
      if (!res.ok) throw new Error("Could not load draft");
      const data = await res.json();
      const parsed = parseBouquetData(data.draft.bouquet_data);
      if (!parsed) throw new Error("Invalid draft bouquet data");

      checkpoint();
      setStems(parsed.stems);
      setBouquetRotation(parsed.rotation);
      setVessel(parsed.vessel);
      setVesselColor(parsed.vesselColor);
      setVesselOpacity(parsed.vesselOpacity);
      setVesselScale(parsed.vesselScale);
      setBackdrop(parsed.backdrop);
      setLightWarmth(parsed.lightWarmth);
      setLightDirection(parsed.lightDirection);
      if (parsed.wind !== undefined) setWind(parsed.wind);

      setActiveDraftId(data.draft.id);
      setActiveDraftVersion(data.draft.version);
      setActiveDraftTitle(data.draft.title);
      setSelectedId(null);
      setHeld(null);
      setToast(t(language, "draftLoaded"));
    } catch {
      setToast(t(language, "savingError"));
    }
  };

  const handleRemixPostcard = (bouquetString: string, toName: string) => {
    const parsed = decodeBouquet(bouquetString);
    if (!parsed) return;
    checkpoint();
    setStems(parsed.stems);
    setBouquetRotation(parsed.rotation);
    setVessel(parsed.vessel);
    setVesselColor(parsed.vesselColor);
    setVesselOpacity(parsed.vesselOpacity);
    setVesselScale(parsed.vesselScale);
    setBackdrop(parsed.backdrop);
    setLightWarmth(parsed.lightWarmth);
    setLightDirection(parsed.lightDirection);
    if (parsed.wind !== undefined) setWind(parsed.wind);

    setActiveDraftId(null);
    setActiveDraftVersion(1);
    setActiveDraftTitle(toName ? `${toName} · ${t(language, "remixCopy")}` : t(language, "untitledBouquet"));
    setSelectedId(null);
    setHeld(null);
    setToast(t(language, "restored"));
  };

  const startOver = () => {
    checkpoint();
    setStems([]);
    setVessel("classic");
    setVesselColor(getDefaultVesselColor("classic"));
    setVesselOpacity(100);
    setVesselScale(1);
    setBouquetRotation({ ...DEFAULT_BOUQUET_ROTATION });
    setBackdrop("linen");
    setLightWarmth(0);
    setLightDirection(DEFAULT_LIGHT_DIRECTION);
    setHeld(null);
    setSelectedId(null);
    setDragId(null);
    setHighResImage(null);
    setActiveDraftId(null);
    setActiveDraftVersion(1);
    setActiveDraftTitle("");
    window.localStorage.removeItem("bloomroom_pending_draft");
    window.history.replaceState(null, "", window.location.pathname);
  };

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.target instanceof HTMLElement && (event.target.matches("input, textarea") || event.target.isContentEditable)) return;
    if (event.key === "Escape") { setHeld(null); setSelectedId(null); setMobilePostcardOpen(false); setFinishOpen(false); return; }
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
    if (modelsLoading) { setToast(t(language, "loadingModels")); return; }
    if (!stems.length) {
      setToast(t(language, "addFirst"));
      return;
    }
    setSelectedId(null);
    setHeld(null);
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      const highResSource = captureSceneRef.current?.(true) || captureSceneRef.current?.();
      if (!highResSource) { setToast(t(language, "captureError")); return; }
      const photo = new Image();
      photo.src = highResSource;
      try { await photo.decode(); } catch { setToast(t(language, "captureError")); return; }
      const snapshot = document.createElement("canvas");
      const width = Math.min(photo.width, 1100);
      const height = Math.round((photo.height / photo.width) * width);
      snapshot.width = width;
      snapshot.height = height;
      const context = snapshot.getContext("2d");
      if (!context) { setToast(t(language, "captureError")); return; }
      const currentBackdropColor = BACKDROP_CONFIG[backdrop]?.color ?? "#EEE9DD";
      context.fillStyle = currentBackdropColor;
      context.fillRect(0, 0, width, height);
      context.drawImage(photo, 0, 0, width, height);
      setFinishImage(snapshot.toDataURL("image/jpeg", 0.88));
      setHighResImage(highResSource);
      setShareUrl(null);
      setPostcardRender(null);
      setShareError("");
      setMobilePostcardOpen(false);
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
          bouquet: encodeBouquet(
            stems,
            bouquetRotation,
            vessel,
            vesselColor,
            vesselOpacity,
            vesselScale,
            backdrop,
            lightWarmth,
            lightDirection,
          ),
          to: recipient,
          message: giftMessage,
          from: sender,
          image: finishImage,
        }),
      });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Could not create a link.");
      setShareUrl(`https://flower.fde.fan${result.path}?lang=${language}`);
    } catch {
      setShareError(t(language, "savingError"));
    } finally {
      setPublishing(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast(t(language, "saved"));
      setShareError("");
      return true;
    } catch {
      setShareError(t(language, "copyError"));
      return false;
    }
  };

  const sharePostcardLink = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t(language, "postcardTitle"),
          text: giftMessage.trim() || t(language, "defaultMessage"),
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    if (await copyShareLink()) setToast(t(language, "shareFallback"));
  };

  const savePostcard = async () => {
    if (!postcardImage) {
      setToast(t(language, "imageLoading"));
      return;
    }
    try {
      if (mobileSave) {
        let blob: Blob;
        try {
          const res = await fetch(postcardImage);
          blob = await res.blob();
        } catch {
          const binary = atob(postcardImage.split(",")[1]);
          const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
          blob = new Blob([bytes], { type: "image/png" });
        }
        const file = new File([blob], "bloomroom-postcard.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: t(language, "postcardTitle") });
            return;
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
          }
        }
        setMobilePostcardOpen(true);
        return;
      }
      const link = document.createElement("a");
      link.href = postcardImage;
      link.download = "bloomroom-postcard.png";
      link.click();
    } catch {
      setToast(t(language, "drawError"));
    }
  };

  return (
    <main className="studio" lang={language === "zh" ? "zh-CN" : language}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div className="brand-copy">
            <strong>Bloomroom</strong>
            <span>{t(language, "brand")}</span>
          </div>
        </div>

        <div className="top-actions">
          <span className="stem-count" aria-live="polite">{stems.length} / 24 {t(language, "stems")}</span>
          <select className="language-select" aria-label={t(language, "language")} value={language} onChange={(event) => changeLanguage(event.target.value as Language)}>
            {LANGUAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <button className="icon-button" aria-label={t(language, "undo")} title={`${t(language, "undo")} (⌘/Ctrl Z)`} disabled={!historyState.undo} onClick={undo}><Undo2 size={15} /></button>
          <button className="icon-button" aria-label={t(language, "redo")} title={`${t(language, "redo")} (⌘/Ctrl Shift Z)`} disabled={!historyState.redo} onClick={redo}><Redo2 size={15} /></button>
          <button
            className="icon-button start-over-button"
            type="button"
            aria-label={t(language, "startOver")}
            title={t(language, "startOver")}
            onClick={startOver}
          >
            <RotateCcw size={15} strokeWidth={1.5} />
          </button>
          <button
            className="save-draft-button"
            type="button"
            aria-label={t(language, "saveDraft")}
            title={t(language, "saveDraft")}
            onClick={handleSaveDraft}
            disabled={savingDraft || stems.length === 0}
          >
            <Bookmark size={14} />
            <span>{savingDraft ? t(language, "savingDraft") : t(language, "saveDraft")}</span>
          </button>
          <button
            className="finish-button"
            disabled={!stems.length}
            type="button"
            onClick={openFinish}
          >
            {t(language, "finish")}
          </button>
          {user ? (
            <div className="user-nav">
              <button
                className="user-garden-button"
                type="button"
                onClick={() => setGardenModalOpen(true)}
                title={t(language, "myGarden")}
              >
                🌿 {t(language, "myGarden")}
              </button>
              <span className="user-badge" title={user.username}>
                {user.username}
              </span>
              <button
                className="icon-button logout-button"
                type="button"
                aria-label={t(language, "logout")}
                title={t(language, "logout")}
                onClick={handleLogout}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              className="login-entry-button"
              type="button"
              onClick={() => {
                setAuthPromptReason("");
                setAuthModalOpen(true);
              }}
            >
              <UserIcon size={14} />
              <span>{t(language, "login")}</span>
            </button>
          )}
        </div>
      </header>

      <section className="workspace" aria-label={t(language, "brand")} data-library-mode={libraryMode} data-editing={selectedStem ? "true" : "false"}>
        <div className="hero-copy">
          <div className="eyebrow">{t(language, "step")}</div>
          <h1>{t(language, "headline")}</h1>
          <p>{t(language, "intro")}</p>
        </div>

        <div
          className="canvas-wrap"
          style={{
            backgroundColor: BACKDROP_CONFIG[backdrop]?.color,
            cursor: dragId ? "grabbing" : held ? "crosshair" : "default",
          }}
        >
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
              vesselScale={vesselScale}
              bouquetRotation={bouquetRotation}
              backdrop={backdrop}
              held={held}
              selectedId={selectedId}
              dragId={dragId}
              onSelect={(id) => { setSelectedId(id); if (id) { setMobileToolsOpen(false); setVesselAdjustOpen(false); } }}
              onDragStart={(id) => { checkpoint(); setDragId(id); }}
              onPlace={placeFlower}
              onDrag={dragFlower}
              onDragEnd={endDrag}
              onRotateStart={checkpoint}
              onRotate={setBouquetRotation}
              projectPointerRef={projectPointerRef}
              captureSceneRef={captureSceneRef}
            />
          </Canvas>
        </div>

        <aside className={libraryMode === "vessels" ? "palette has-vessel-library" : "palette"} aria-label={t(language, "library")}>
          <div className="palette-modes" role="tablist" aria-label={t(language, "library")}>
            {([
              ["flowers", t(language, "flowers"), t(language, "flowers")],
              ["vessels", t(language, "containers"), t(language, "containers")],
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
              <span className="palette-step">{libraryMode === "flowers" ? `01 / ${t(language, "flowers")}` : `02 / ${t(language, "containers")}`}</span>
              <h2>{libraryMode === "flowers" ? t(language, "chooseFlowers") : t(language, "chooseContainer")}</h2>
              <p>{libraryMode === "flowers" ? t(language, "chooseFlowersHint") : t(language, "chooseContainerHint")}</p>
            </div>
          </div>

          {libraryMode === "flowers" ? <>
            <div className="category-tabs" role="tablist" aria-label={t(language, "flowers")}>
              {(Object.keys(CATEGORY_LABELS) as FlowerCategory[]).map((item) => {
                const count = FLOWERS.filter((flower) => flower.category === item && flower.kind !== "blue-poppy").length;
                return <button key={item} type="button" role="tab" aria-selected={category === item}
                  className={category === item ? "category-tab active" : "category-tab"}
                  onClick={() => setCategory(item)}>
                  <span>{categoryName(language, item)}</span><small>{categoryName(language, item)} · {count}</small>
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
                  if (event.button !== 0 || event.pointerType === "touch") return;
                  suppressClick.current = false;
                  paletteDrag.current = { x: event.clientX, y: event.clientY, moved: false };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (event.pointerType === "touch") return;
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
                onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } placeFlower(autoPlacementPoint(flower.kind, stems, vessel, vesselScale), flower.kind); }}
              >
                <FlowerThumbnail kind={flower.kind} />
                <span className="flower-card-plus" aria-hidden="true">+</span>
                <strong>{flowerName(language, flower.kind)}</strong>
                <small>{flower.latin}</small>
                {stems.some((stem) => stem.kind === flower.kind) ? <span className="added-indicator">{t(language, "added")} · {stems.filter((stem) => stem.kind === flower.kind).length}</span> : null}
                {flower.availability !== "available" ? (
                  <span
                    className={`availability ${flower.availability}`}
                  >
                    {flower.availability === "play"
                      ? t(language, "studioOnly")
                      : t(language, "preorder")}
                  </span>
                ) : null}
              </button>
              ))}
            </div>
          </> : null}

          {libraryMode === "vessels" ? <div className="library-scroll vessel-library">
            <div className="vessel-tabs" role="tablist" aria-label={t(language, "containers")}>
              <button type="button" role="tab" aria-selected={vesselCategory === "vase"} className={vesselCategory === "vase" ? "vessel-tab active" : "vessel-tab"} onClick={() => setVesselCategory("vase")}>{t(language, "vase")}</button>
              <button type="button" role="tab" aria-selected={vesselCategory === "bouquet"} className={vesselCategory === "bouquet" ? "vessel-tab active" : "vessel-tab"} onClick={() => setVesselCategory("bouquet")}>{t(language, "bouquets")}</button>
              <button type="button" role="tab" aria-selected={vesselCategory === "imagination"} className={vesselCategory === "imagination" ? "vessel-tab active" : "vessel-tab"} onClick={() => setVesselCategory("imagination")}>{t(language, "imagination")}</button>
            </div>
            {vesselCategory === "imagination" ? <div className="vessel-options-scroll bouquet-grid">
              {BOUQUET_PRESETS.map((preset) => (
                <button key={preset.id} type="button" className="bouquet-card" onClick={() => applyBouquetPreset(preset)}>
                  <BouquetThumbnail preset={preset} />
              <span className="bouquet-card-copy"><strong>{presetName(language, preset.id as "first-light" | "meadow-air" | "cloud-study")}</strong><small>{presetNote(language, preset.id as "first-light" | "meadow-air" | "cloud-study")}</small></span>
                  <span className="bouquet-card-count">{preset.stems.length} {t(language, "stems")}</span>
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
                  <strong>{vesselName(language, option.kind)}</strong><small>{vesselNote(language, option.kind)}</small>
                </button>
              ))}
            </div>}
          </div> : null}
        </aside>

        <button type="button" className="vessel-adjust-toggle" aria-expanded={vesselAdjustOpen} aria-controls="vessel-adjust-panel" disabled={vessel === "naked"} onClick={() => { setVesselAdjustOpen((open) => !open); setSelectedId(null); setMobileToolsOpen(false); }}><SlidersHorizontal size={15} /> {t(language, "adjustContainer")}</button>
        {vesselAdjustOpen && vessel !== "naked" && <section id="vessel-adjust-panel" className="selection-card vessel-adjust-panel" aria-label={t(language, "adjustContainer")}>
          <div className="vessel-adjust-heading"><strong>{t(language, "adjustContainer")}</strong><button type="button" aria-label={t(language, "done")} onClick={() => setVesselAdjustOpen(false)}><X size={17} /></button></div>
            <div className="vessel-appearance">
              <span className="vessel-appearance-title">{t(language, "containerColor")}</span>
              <div className="color-options" role="group" aria-label={t(language, "containerColor")}>
                {getVesselColors(vessel).map((option) => <button
                  key={option.color}
                  type="button"
                  className="color-option"
                  style={{ "--petal-color": option.color } as React.CSSProperties}
                  aria-label={colorName(language, option.label)}
                  aria-pressed={vesselColor === option.color}
                  title={colorName(language, option.label)}
                  onClick={() => chooseVesselColor(option.color)}
                ><span /></button>)}
              </div>
              <label htmlFor="vessel-opacity"><span>{t(language, "opacity")}</span><output>{vesselOpacity}%</output></label>
              <input
                id="vessel-opacity"
                className="range"
                type="range"
                min="0"
                max="100"
                step="5"
                value={vesselOpacity}
                aria-label={t(language, "opacity")}
                onPointerDown={checkpoint}
                onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) checkpoint(); }}
                onChange={(event) => setVesselOpacity(Number(event.target.value))}
              />
              <label htmlFor="vessel-size"><span>{t(language, "containerSize")}</span><output>{Math.round(vesselScale * 100)}%</output></label>
              <input id="vessel-size" className="range" type="range" min="70" max="130" step="1" value={Math.round(vesselScale * 100)} aria-label={t(language, "containerSize")} onPointerDown={checkpoint} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) checkpoint(); }} onChange={(event) => setVesselScale(Number(event.target.value) / 100)} />
            </div>
        </section>}

        <button type="button" className="mobile-tools-toggle" aria-expanded={mobileToolsOpen} aria-controls="studio-scene-tools"
          onClick={() => { setMobileToolsOpen((open) => !open); setSelectedId(null); }}>
          {mobileToolsOpen ? <X size={17} /> : <SlidersHorizontal size={17} />}
          <span>{t(language, "tools")}</span>
        </button>
        <aside id="studio-scene-tools" className={mobileToolsOpen ? "scene-tools mobile-open" : "scene-tools"} aria-label={t(language, "tools")}>
          <div className="tool-section">
            <button type="button" className="adjust-toggle" disabled={!stems.length}
              aria-expanded={!!selectedStem}
              onClick={() => { setVesselAdjustOpen(false); setSelectedId(selectedStem ? null : stems[0].id); }}>
              <span>{t(language, "adjust")}</span><span>{stems.length}</span>
            </button>
            <p className="rotation-hint">{t(language, "adjustHint")}</p>
          </div>
          <div className="tool-section">
            <div className="tool-label">
              <span>{t(language, "morningLight")}</span>
              <Sparkles size={13} strokeWidth={1.4} />
            </div>
            <div className="backdrop-control">
              <div className="backdrop-selector" role="radiogroup" aria-label={t(language, "backdrop")}>
                {BACKDROP_OPTIONS.map((option) => {
                  const isChecked = backdrop === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isChecked}
                      className="backdrop-pill"
                      onClick={() => {
                        checkpoint();
                        setBackdrop(option.id);
                      }}
                      title={backdropName(language, option.id)}
                    >
                      <span className="backdrop-swatch" style={{ backgroundColor: option.color }} />
                      <span className="backdrop-name">{backdropName(language, option.id)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="light-adjustments">
              <label className="light-control" htmlFor="light-warmth">
                <span>{t(language, "warmth")}</span><output>{lightWarmth === 0 ? t(language, "balanced") : lightWarmth > 0 ? `+${lightWarmth}` : lightWarmth}</output>
              </label>
              <input id="light-warmth" className="range" type="range" min="-100" max="100" value={lightWarmth}
                aria-label={t(language, "warmth")} onChange={(event) => setLightWarmth(Number(event.target.value))} />
              <div className="light-scale"><span>{t(language, "cool")}</span><span>{t(language, "warm")}</span></div>
              <label className="light-control" htmlFor="light-direction">
                <span>{t(language, "direction")}</span><output>{lightDirection}°</output>
              </label>
              <input id="light-direction" className="range" type="range" min="-180" max="180" value={lightDirection}
                aria-label={t(language, "direction")} onChange={(event) => setLightDirection(Number(event.target.value))} />
              <div className="light-scale"><span>{t(language, "turnLeft")}</span><span>{t(language, "turnRight")}</span></div>
            </div>
          </div>

          <div className="tool-section">
            <div className="tool-label">
              <span>{t(language, "wind")}</span>
              <Wind size={13} strokeWidth={1.4} />
            </div>
            <input
              className="range"
              type="range"
              min="0"
              max="100"
              value={Math.round(wind * 100)}
              aria-label={t(language, "windStrength")}
              onChange={(event) =>
                setWind(Number(event.target.value) / 100)
              }
            />
          </div>

          <AmbientSoundPanel language={language} />

          <div className="tool-section rotation-section">
            <button
              type="button"
              className="rotation-toggle"
              aria-expanded={rotationOpen}
              aria-controls="bouquet-rotation-controls"
              aria-describedby="bouquet-rotation-hint"
              title={t(language, "rotateHint")}
              onClick={() => setRotationOpen((open) => !open)}
            >
              <span>{t(language, "rotateVase")}</span>
              <RotateCcw size={13} strokeWidth={1.5} />
            </button>
            <p className="rotation-hint" id="bouquet-rotation-hint">
              <span className="rotation-hint-desktop">{t(language, "rotateHint")}</span>
              <span className="rotation-hint-touch">{t(language, "rotateTouchHint")}</span>
            </p>
            <div id="bouquet-rotation-controls" className="rotation-controls" hidden={!rotationOpen}>
                <div className="rotation-axis">
                  <label htmlFor="bouquet-rotation-x">
                    <span>X · {t(language, "tilt")}</span><span>{Math.round(bouquetRotation.x)}°</span>
                  </label>
                  <input
                    id="bouquet-rotation-x"
                    className="range"
                    type="range"
                    min="-35"
                    max="35"
                    step="1"
                    value={bouquetRotation.x}
                    aria-label={`${t(language, "tilt")} X`}
                    onPointerDown={checkpoint}
                    onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) checkpoint(); }}
                    onChange={(event) => setBouquetRotation((current) => ({ ...current, x: Number(event.target.value) }))}
                  />
                </div>
                <div className="rotation-axis">
                  <label htmlFor="bouquet-rotation-y">
                    <span>Y · {t(language, "turn")}</span><span>{Math.round(bouquetRotation.y)}°</span>
                  </label>
                  <input
                    id="bouquet-rotation-y"
                    className="range"
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={bouquetRotation.y}
                    aria-label={`${t(language, "turn")} Y`}
                    onPointerDown={checkpoint}
                    onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) checkpoint(); }}
                    onChange={(event) => setBouquetRotation((current) => ({ ...current, y: Number(event.target.value) }))}
                  />
                </div>
                <div className="rotation-axis">
                  <label htmlFor="bouquet-rotation-z">
                    <span>Z · {t(language, "roll")}</span><span>{Math.round(bouquetRotation.z)}°</span>
                  </label>
                  <input
                    id="bouquet-rotation-z"
                    className="range"
                    type="range"
                    min="-35"
                    max="35"
                    step="1"
                    value={bouquetRotation.z}
                    aria-label={`${t(language, "roll")} Z`}
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
                  {t(language, "resetRotation")}
                </button>
            </div>
          </div>
        </aside>

        {selectedStem ? <StemAdjustmentControls
          stem={selectedStem}
          stems={stems}
          colors={selectedColors}
          colorVariant={selectedColorVariant}
          language={language}
          wrapped={isWrappedVessel(vessel)}
          onSelectStem={setSelectedId}
          onStartChange={checkpoint}
          onHeightChange={updateSelectedHeight}
          onSizeChange={updateSelectedSize}
          onAngleChange={updateSelectedAngle}
          onColorChange={updateSelectedColor}
          onRemove={removeSelected}
          onDone={() => setSelectedId(null)}
        /> : null}

        {held ? (
          <div className="hint" role="status">
            {flowerName(language, held)} · {t(language, "dragPrompt")}
          </div>
        ) : stems.length === 0 ? (
          <div className="hint" role="status">
            {t(language, "placePrompt")}
          </div>
        ) : null}
      </section>

      {finishOpen ? (
        <div className="finish-overlay" role="dialog" aria-modal="true" ref={finishOverlayRef}>
          <div className="finish-card">
            <div
              className="finish-preview"
              style={
                (postcardImage || finishImage)
                  ? {
                      backgroundImage: `url(${postcardImage || finishImage})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: postcardImage ? "center" : "center 38%",
                    }
                  : undefined
              }
            >
              <button
                className="close-finish"
                type="button"
                aria-label={t(language, "back")}
                onClick={() => setFinishOpen(false)}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
              {!postcardImage && <div className="finish-preview-caption">
                <span>{t(language, "postcardTitle")}</span>
                {recipient.trim() && <strong>{t(language, "toName")} {recipient.trim()}</strong>}
                <p>{giftMessage.trim() || t(language, "defaultMessage")}</p>
                {sender.trim() && <em>{t(language, "fromName")} {sender.trim()}</em>}
              </div>}
            </div>

            <div className="finish-copy">
              <div className="eyebrow">{t(language, "sendEyebrow")}</div>
              <h2>{t(language, "sendTitle")}</h2>
              <p>{t(language, "sendHint")}</p>

              <div className="gift-fields">
                <label htmlFor="gift-to">{t(language, "to")}</label>
                <input id="gift-to" type="text" maxLength={64} placeholder={t(language, "recipientPlaceholder")} value={recipient}
                  onChange={(event) => { setRecipient(event.target.value); setShareUrl(null); }} />
                <label htmlFor="gift-message">{t(language, "message")}</label>
                <textarea id="gift-message" rows={4} maxLength={240} placeholder={t(language, "messagePlaceholder")}
                  value={giftMessage} onChange={(event) => { setGiftMessage(event.target.value); setShareUrl(null); }} />
                <small>{giftMessage.length} / 240</small>
                <label htmlFor="gift-from">{t(language, "from")}</label>
                <input id="gift-from" type="text" maxLength={64} placeholder={t(language, "senderPlaceholder")} value={sender}
                  onChange={(event) => { setSender(event.target.value); setShareUrl(null); }} />
              </div>

              {shareUrl && <div className="share-result" aria-live="polite">
                <label htmlFor="postcard-link">{t(language, "privateLink")}</label>
                <input id="postcard-link" type="text" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
                <div className="share-result-actions">
                  <button type="button" className="share-direct" onClick={sharePostcardLink}><Share2 size={13} /> {t(language, "shareDirectly")}</button>
                  <button type="button" onClick={copyShareLink}><Copy size={13} /> {t(language, "copyLink")}</button>
                </div>
              </div>}
              {shareError && <p className="share-error" role="alert">{shareError}</p>}

              <div className="finish-actions">
                <button type="button" className="primary" onClick={savePostcard} disabled={!postcardImage}>
                  <Download size={13} /> {mobileSave ? t(language, "saveToPhotos") : t(language, "download")}
                </button>
                <button type="button" onClick={createShareLink} disabled={publishing || !finishImage}>
                  {publishing ? t(language, "creating") : shareUrl ? t(language, "createAnother") : t(language, "createLink")}
                </button>
                <button
                  type="button"
                  onClick={() => setFinishOpen(false)}
                >
                  {t(language, "back")}
                </button>
              </div>
            </div>
          </div>
          <button className="mobile-finish-close" type="button" aria-label={t(language, "back")} onClick={() => setFinishOpen(false)}>
            <X size={18} strokeWidth={1.5} />
          </button>
          {mobilePostcardOpen && postcardImage && (
            <div className="mobile-postcard-view" role="dialog" aria-modal="true" aria-label={t(language, "saveToPhotos")}>
              <button type="button" onClick={() => setMobilePostcardOpen(false)} aria-label={t(language, "back")}>×</button>
              <p>{t(language, "longPressToSave")}</p>
              {/* Native image context menus expose Save Image on mobile browsers without file sharing. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={postcardImage} alt={t(language, "postcardTitle")} />
            </div>
          )}
        </div>
      ) : null}

      <AuthModal
        isOpen={authModalOpen}
        language={language}
        promptReason={authPromptReason}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={onAuthSuccess}
      />

      <GardenModal
        isOpen={gardenModalOpen}
        language={language}
        user={user}
        onClose={() => setGardenModalOpen(false)}
        onLoadDraft={handleLoadDraft}
        onRemixPostcard={handleRemixPostcard}
      />

      <a className="model-credits" href="/models/credits.html" target="_blank" rel="noreferrer">{t(language, "credits")} ↗</a>
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
