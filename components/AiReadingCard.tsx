"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Copy, Check, Download, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import { t, type Language } from "@/lib/translations";
import type { AiReading, BouquetDataInput } from "@/lib/ai-reading";

type Props = {
  language: Language;
  bouquetData: BouquetDataInput;
  bouquetImage: string | null;
  currentFingerprint: string;
  onReadingChange?: (reading: AiReading | null) => void;
};

const STORAGE_KEY = "bloomroom_ai_readings";

export default function AiReadingCard({
  language,
  bouquetData,
  bouquetImage,
  currentFingerprint,
  onReadingChange,
}: Props) {
  const [reading, setReading] = useState<AiReading | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [mobileModalImage, setMobileModalImage] = useState<string | null>(null);

  const onReadingChangeRef = useRef(onReadingChange);
  useEffect(() => {
    onReadingChangeRef.current = onReadingChange;
  }, [onReadingChange]);

  // Load from local storage when fingerprint or language changes
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, AiReading>;
        const exactKey = `${currentFingerprint}:${language}`;
        if (parsed[exactKey]) {
          setReading(parsed[exactKey]);
          onReadingChangeRef.current?.(parsed[exactKey]);
          setError(null);
          return;
        }

        // Check if there is any past reading for this language to show as previous version
        const keys = Object.keys(parsed).filter((k) => k.endsWith(`:${language}`));
        if (keys.length > 0) {
          const latestKey = keys[keys.length - 1];
          setReading(parsed[latestKey]);
          onReadingChangeRef.current?.(parsed[latestKey]);
          return;
        }
      }
    } catch {
      // Storage error ignored
    }
    setReading(null);
    onReadingChangeRef.current?.(null);
  }, [currentFingerprint, language]);

  const saveReadingToStorage = (newReading: AiReading) => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const map = stored ? (JSON.parse(stored) as Record<string, AiReading>) : {};
      map[`${newReading.fingerprint}:${newReading.language}`] = newReading;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Storage error ignored
    }
  };

  /**
   * Compresses the image to max 768px for the AI API.
   */
  const compressImage = async (src: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const maxDim = 768;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } else {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);

    try {
      let compressedImage: string | undefined = undefined;
      if (bouquetImage) {
        try {
          compressedImage = await compressImage(bouquetImage);
        } catch {
          compressedImage = undefined;
        }
      }

      const res = await fetch("/api/ai/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bouquetData,
          imageDataUrl: compressedImage,
          language,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reading?: AiReading;
        error?: string;
      };

      if (!res.ok || !data.reading) {
        throw new Error(data.error || t(language, "readingError"));
      }

      setReading(data.reading);
      saveReadingToStorage(data.reading);
      onReadingChange?.(data.reading);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t(language, "readingError");
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyText = async () => {
    if (!reading) return;
    const text = `【${reading.title}】\n\n${reading.composition}\n\n${reading.reflection}\n\n—— “${reading.quote}”\n（Bloomroom · ${t(language, "aiReading")}）`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t(language, "copyError"));
    }
  };

  /**
   * Generates and downloads an aesthetic reading card image.
   */
  const handleSaveCardImage = async () => {
    if (!reading || savingCard) return;
    setSavingCard(true);

    try {
      const width = 800;
      const height = 1120;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");

      // Background paper tone
      ctx.fillStyle = "#f6f3eb";
      ctx.fillRect(0, 0, width, height);

      // Delicate inner border
      ctx.strokeStyle = "rgba(71, 84, 67, 0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(36, 36, width - 72, height - 72);

      // Header branding
      ctx.fillStyle = "#8a867c";
      ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.letterSpacing = "3px";
      ctx.fillText(`BLOOMROOM · ${t(language, "aiReading").toUpperCase()}`, width / 2, 74);

      // Draw bouquet thumbnail if available
      let contentStartY = 390;
      if (bouquetImage) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = bouquetImage;
          await img.decode();

          const thumbW = 480;
          const thumbH = 260;
          const thumbX = (width - thumbW) / 2;
          const thumbY = 100;

          // Clip rounded rectangle for image
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(thumbX, thumbY, thumbW, thumbH, 12);
          ctx.clip();
          ctx.drawImage(img, thumbX, thumbY, thumbW, thumbH);
          ctx.restore();

          // Subtle frame around image
          ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(thumbX, thumbY, thumbW, thumbH, 12);
          ctx.stroke();

          contentStartY = 400;
        } catch {
          contentStartY = 160;
        }
      } else {
        contentStartY = 160;
      }

      // Title (Georgia serif)
      ctx.fillStyle = "#22231f";
      ctx.font = "bold 30px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(reading.title, width / 2, contentStartY);

      // Quote banner
      const quoteY = contentStartY + 50;
      ctx.fillStyle = "rgba(71, 84, 67, 0.06)";
      ctx.beginPath();
      ctx.roundRect(width / 2 - 260, quoteY - 24, 520, 44, 22);
      ctx.fill();

      ctx.fillStyle = "#475443";
      ctx.font = "italic 16px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(`“${reading.quote}”`, width / 2, quoteY + 4);

      // Helper function to draw wrapped text
      const drawWrappedText = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
      ): number => {
        let curY = y;
        let line = "";
        for (let i = 0; i < text.length; i++) {
          const testLine = line + text[i];
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line.length > 0) {
            ctx.fillText(line, x, curY);
            line = text[i];
            curY += lineHeight;
          } else {
            line = testLine;
          }
        }
        if (line) {
          ctx.fillText(line, x, curY);
          curY += lineHeight;
        }
        return curY;
      };

      // Composition text
      ctx.textAlign = "left";
      ctx.fillStyle = "#3d3c37";
      ctx.font = "14px/1.8 -apple-system, BlinkMacSystemFont, sans-serif";
      const compStartY = quoteY + 60;
      const compEndY = drawWrappedText(reading.composition, 110, compStartY, 580, 26);

      // Subtle divider line
      const divY = compEndY + 18;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.beginPath();
      ctx.moveTo(width / 2 - 40, divY);
      ctx.lineTo(width / 2 + 40, divY);
      ctx.stroke();

      // Reflection text
      ctx.fillStyle = "#5a5852";
      ctx.font = "14px/1.8 -apple-system, BlinkMacSystemFont, sans-serif";
      drawWrappedText(reading.reflection, 110, divY + 34, 580, 26);

      // Footer disclaimer
      ctx.textAlign = "center";
      ctx.fillStyle = "#8a867c";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(t(language, "aiReadingDisclaimer"), width / 2, height - 72);

      const dataUrl = canvas.toDataURL("image/png");

      // Check if mobile supports Web Share API with file
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        let blob: Blob;
        const binary = atob(dataUrl.split(",")[1]);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        blob = new Blob([bytes], { type: "image/png" });
        const file = new File([blob], "bloomroom-reflection.png", { type: "image/png" });

        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: reading.title,
            });
            setSavingCard(false);
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
              setSavingCard(false);
              return;
            }
          }
        }
        setMobileModalImage(dataUrl);
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `bloomroom-reflection-${reading.title}.png`;
        link.click();
      }
    } catch (err) {
      console.error("Save card error:", err);
      setError(t(language, "drawError"));
    } finally {
      setSavingCard(false);
    }
  };

  const isOutdated = reading && reading.fingerprint !== currentFingerprint;

  return (
    <div className="ai-reading-section">
      <div className="ai-reading-header">
        <div className="ai-reading-title-wrap">
          <Sparkles size={16} className="ai-reading-icon" />
          <h3 className="ai-reading-title">{t(language, "aiReading")}</h3>
        </div>
        <p className="ai-reading-subtitle">{t(language, "aiReadingHint")}</p>
      </div>

      {!reading && !generating && (
        <div className="ai-reading-cta">
          <button
            type="button"
            className="ai-reading-generate-btn"
            onClick={handleGenerate}
          >
            <Sparkles size={14} />
            <span>{t(language, "generateReading")}</span>
          </button>
        </div>
      )}

      {generating && (
        <div className="ai-reading-loading" role="status">
          <Loader2 size={18} className="spinner" />
          <span>{t(language, "generatingReading")}</span>
        </div>
      )}

      {error && !generating && (
        <div className="ai-reading-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button
            type="button"
            className="ai-reading-retry-link"
            onClick={handleGenerate}
          >
            <RotateCcw size={12} />
          </button>
        </div>
      )}

      {reading && !generating && (
        <div className="ai-reading-card">
          {isOutdated && (
            <div className="ai-reading-outdated-badge">
              <span>{t(language, "outdatedReadingNotice")}</span>
              <button
                type="button"
                className="ai-reading-recalc-btn"
                onClick={handleGenerate}
              >
                <RotateCcw size={12} />
                <span>{t(language, "regenerateReading")}</span>
              </button>
            </div>
          )}

          <div className="ai-reading-body">
            <h4 className="ai-reading-card-title">{reading.title}</h4>

            <div className="ai-reading-quote-pill">
              <span className="quote-mark">“</span>
              <span className="quote-text">{reading.quote}</span>
              <span className="quote-mark">”</span>
            </div>

            <div className="ai-reading-item">
              <span className="ai-reading-item-label">{t(language, "readingComposition")}</span>
              <p className="ai-reading-item-desc">{reading.composition}</p>
            </div>

            <div className="ai-reading-item">
              <span className="ai-reading-item-label">{t(language, "readingReflection")}</span>
              <p className="ai-reading-item-desc">{reading.reflection}</p>
            </div>
          </div>

          <div className="ai-reading-actions">
            <button
              type="button"
              className="ai-reading-action-btn"
              onClick={handleCopyText}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? t(language, "readingCopied") : t(language, "copyReading")}</span>
            </button>

            <button
              type="button"
              className="ai-reading-action-btn"
              onClick={handleSaveCardImage}
              disabled={savingCard}
            >
              {savingCard ? <Loader2 size={13} className="spinner" /> : <Download size={13} />}
              <span>{savingCard ? t(language, "savingReadingCard") : t(language, "saveReadingCard")}</span>
            </button>

            {!isOutdated && (
              <button
                type="button"
                className="ai-reading-action-btn subtle"
                onClick={handleGenerate}
                title={t(language, "regenerateReading")}
              >
                <RotateCcw size={13} />
                <span>{t(language, "regenerateReading")}</span>
              </button>
            )}
          </div>

          <div className="ai-reading-disclaimer">
            <span>{t(language, "aiReadingDisclaimer")}</span>
          </div>
        </div>
      )}

      {mobileModalImage && (
        <div
          className="mobile-postcard-view"
          role="dialog"
          aria-modal="true"
          aria-label={t(language, "saveToPhotos")}
        >
          <button
            type="button"
            onClick={() => setMobileModalImage(null)}
            aria-label={t(language, "back")}
          >
            ×
          </button>
          <p>{t(language, "longPressToSave")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mobileModalImage} alt={reading?.title || "Reading card"} />
        </div>
      )}
    </div>
  );
}
