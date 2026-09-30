"use client";

import dynamic from "next/dynamic";

const FlowerStudio = dynamic(() => import("@/components/FlowerStudio"), {
  ssr: false,
  loading: () => (
    <main className="loading-screen">
      <div className="loading-mark">B</div>
      <p>Preparing the flowers…</p>
    </main>
  ),
});

export default function Home() {
  return <FlowerStudio />;
}
