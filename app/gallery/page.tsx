"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import GalleryModal from "@/components/GalleryModal";
import { t, type Language } from "@/lib/translations";

export default function GalleryPage() {
  const [language, setLanguage] = useState<Language>("zh");

  // Since it's a standalone page, onClose navigates back to studio
  const handleClose = () => {
    window.location.href = "/";
  };

  const handleRemix = (bouquetData: any, title?: string) => {
    try {
      window.sessionStorage.setItem(
        "bloomroom_remix_payload",
        JSON.stringify({ bouquetData, title }),
      );
    } catch {
      // Ignored
    }
    window.location.href = "/";
  };

  return (
    <main className="gallery-standalone-page">
      <GalleryModal
        isOpen={true}
        onClose={handleClose}
        language={language}
        onRemixCreation={handleRemix}
      />
    </main>
  );
}
