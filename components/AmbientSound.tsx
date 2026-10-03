"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { soundName, t, type Language } from "../lib/translations";
import {
  Volume2,
  VolumeX,
  Waves,
  Wind,
  CloudRain,
  Bird,
  Flame,
  Bug,
} from "lucide-react";

export type AmbientId = "none" | "waves" | "wind" | "rain" | "birds" | "fireplace" | "cicadas";

export interface AmbientOption {
  id: AmbientId;
  label: string;
  labelZh: string;
  src?: string;
  icon: typeof Waves;
  note: string;
}

export const AMBIENT_OPTIONS: AmbientOption[] = [
  {
    id: "waves",
    label: "Waves",
    labelZh: "海浪",
    src: "/audio/waves.mp3",
    icon: Waves,
    note: "Gentle ocean surf",
  },
  {
    id: "wind",
    label: "Breeze",
    labelZh: "海风",
    src: "/audio/wind.mp3",
    icon: Wind,
    note: "Soft coastal wind",
  },
  {
    id: "rain",
    label: "Rain",
    labelZh: "小雨",
    src: "/audio/rain.mp3",
    icon: CloudRain,
    note: "Tranquil terrace rain",
  },
  {
    id: "birds",
    label: "Birds",
    labelZh: "鸟鸣",
    src: "/audio/birds.mp3",
    icon: Bird,
    note: "Morning forest birds",
  },
  {
    id: "fireplace",
    label: "Fireplace",
    labelZh: "壁炉",
    src: "/audio/fireplace.mp3",
    icon: Flame,
    note: "Cozy wood embers",
  },
  {
    id: "cicadas",
    label: "Cicadas",
    labelZh: "蝉鸣",
    src: "/audio/cicadas.mp3",
    icon: Bug,
    note: "Summer cicadas chorus",
  },
];

interface AmbientSoundProps {
  currentId?: AmbientId;
  onChange?: (id: AmbientId) => void;
  language?: Language;
}

export function AmbientSoundPanel({ currentId: externalId, onChange, language = "en" }: AmbientSoundProps) {
  const [localId, setLocalId] = useState<AmbientId>("none");
  const activeId = externalId ?? localId;
  const [volume, setVolume] = useState<number>(0.65);
  const [muted, setMuted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let wasPlayingBeforePause = false;

    const handlePause = () => {
      if (audioRef.current && !audioRef.current.paused) {
        wasPlayingBeforePause = true;
        audioRef.current.pause();
      }
    };

    const handleResume = () => {
      if (wasPlayingBeforePause && audioRef.current) {
        audioRef.current.play().catch(() => {});
        wasPlayingBeforePause = false;
      }
    };

    window.addEventListener("bloomroom-pause-ambient", handlePause);
    window.addEventListener("bloomroom-resume-ambient", handleResume);
    return () => {
      window.removeEventListener("bloomroom-pause-ambient", handlePause);
      window.removeEventListener("bloomroom-resume-ambient", handleResume);
    };
  }, []);

  const smoothFade = useCallback((targetVolume: number, onComplete?: () => void) => {
    if (!audioRef.current) return;
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

    const audio = audioRef.current;
    const startVolume = audio.volume;
    const delta = targetVolume - startVolume;
    const steps = 15;
    const stepDuration = 300 / steps;
    let step = 0;

    fadeIntervalRef.current = setInterval(() => {
      step++;
      const current = startVolume + (delta * (step / steps));
      audio.volume = Math.max(0, Math.min(1, current));

      if (step >= steps) {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
        audio.volume = targetVolume;
        if (onComplete) onComplete();
      }
    }, stepDuration);
  }, []);

  // Handle track switching
  useEffect(() => {
    const selected = AMBIENT_OPTIONS.find((opt) => opt.id === activeId);

    if (!selected || !selected.src) {
      // Fade out and stop
      if (audioRef.current && isPlaying) {
        smoothFade(0, () => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          setIsPlaying(false);
        });
      }
      return;
    }

    // Changing to a new track
    const effectiveVol = muted ? 0 : volume;

    if (!audioRef.current) {
      const audio = new Audio(selected.src);
      audio.loop = true;
      audio.volume = 0;
      audioRef.current = audio;

      audio.play().then(() => {
        setIsPlaying(true);
        smoothFade(effectiveVol);
      }).catch((err) => {
        console.warn("Audio autoplay prevented or failed:", err);
        setIsPlaying(false);
      });
    } else {
      // Crossfade to new audio
      smoothFade(0, () => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.src = selected.src!;
        audioRef.current.load();
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          smoothFade(effectiveVol);
        }).catch((err) => {
          console.warn("Audio playback error:", err);
          setIsPlaying(false);
        });
      });
    }
  }, [activeId, smoothFade]);

  // Handle volume changes
  useEffect(() => {
    if (!audioRef.current || !isPlaying) return;
    const target = muted ? 0 : volume;
    audioRef.current.volume = target;
  }, [volume, muted, isPlaying]);

  const toggleTrack = (id: AmbientId) => {
    const next = activeId === id ? "none" : id;
    setLocalId(next);
    if (onChange) onChange(next);
  };

  const toggleMute = () => {
    setMuted((prev) => !prev);
  };

  const activeOption = AMBIENT_OPTIONS.find((o) => o.id === activeId);

  return (
    <div className="tool-section ambient-sound-section">
      <div className="tool-label">
        <span className="ambient-label-text">
          {t(language, "ambience")}
          {isPlaying && activeOption && (
            <span className="ambient-pulse" title={`${soundName(language, activeOption.id as Exclude<AmbientId, "none">)}`}>
              <span className="pulse-bar" />
              <span className="pulse-bar" />
              <span className="pulse-bar" />
            </span>
          )}
        </span>
        <button
          type="button"
          className="ambient-mute-btn"
          aria-label={muted ? t(language, "unmute") : t(language, "mute")}
          onClick={toggleMute}
          title={muted ? t(language, "unmute") : t(language, "mute")}
        >
          {muted || volume === 0 || activeId === "none" ? (
            <VolumeX size={13} strokeWidth={1.4} />
          ) : (
            <Volume2 size={13} strokeWidth={1.4} />
          )}
        </button>
      </div>

      <div className="ambient-grid">
        {AMBIENT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = activeId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={`ambient-btn ${active ? "active" : ""}`}
              onClick={() => toggleTrack(opt.id)}
              title={`${soundName(language, opt.id as Exclude<AmbientId, "none">)} · ${opt.note}`}
            >
              <Icon size={12} strokeWidth={1.5} />
              <span>{soundName(language, opt.id as Exclude<AmbientId, "none">)}</span>
            </button>
          );
        })}
      </div>

      {activeId !== "none" && (
        <div className="ambient-volume-row">
          <label className="ambient-volume-label" htmlFor="ambient-volume-slider">
            <span>{t(language, "volume")}</span>
            <output>{Math.round(volume * 100)}%</output>
          </label>
          <input
            id="ambient-volume-slider"
            className="range ambient-range"
            type="range"
            min="0"
            max="100"
            value={muted ? 0 : Math.round(volume * 100)}
            aria-label={t(language, "volume")}
            onChange={(e) => {
              const val = Number(e.target.value) / 100;
              setVolume(val);
              if (muted && val > 0) setMuted(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
