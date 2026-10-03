"use client";

import dynamic from "next/dynamic";
import { BloomLoader } from "@/components/BloomLoader";

const FlowerStudio = dynamic(() => import("@/components/FlowerStudio"), {
  ssr: false,
  loading: () => (
    <main className="loading-screen" role="status" aria-live="polite">
      <BloomLoader
        size="lg"
        label="Bloomroom"
        sublabel="数字花艺工作室 · Preparing the flowers…"
      />
    </main>
  ),
});

export default function Home() {
  return <FlowerStudio />;
}
