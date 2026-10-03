"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, RotateCcw, AlertCircle } from "lucide-react";
import { t, type Language } from "@/lib/translations";
import { MiniSpinner } from "@/components/BloomLoader";
import styles from "@/app/g/[id]/page.module.css";

type Props = {
  postcardId: string;
  language: Language;
  initialDurationMs?: number | null;
};

export default function PostcardAudioPlayer({
  postcardId,
  language,
  initialDurationMs,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(
    initialDurationMs ? initialDurationMs / 1000 : 0,
  );
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFetchingRef = useRef(false);

  const fetchSignedAudioUrl = async (): Promise<string | null> => {
    if (isFetchingRef.current) return null;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/postcards/${postcardId}/audio`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Could not fetch audio URL");
      }
      const data = (await res.json()) as { audioUrl: string; durationMs?: number };
      setAudioUrl(data.audioUrl);
      if (data.durationMs) {
        setDuration(data.durationMs / 1000);
      }
      return data.audioUrl;
    } catch (err) {
      console.warn("Failed to fetch postcard audio", err);
      setError(t(language, "audioPlayError"));
      return null;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleTogglePlay = async () => {
    setError(null);

    let activeUrl = audioUrl;
    if (!activeUrl) {
      activeUrl = await fetchSignedAudioUrl();
      if (!activeUrl) return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        if (audio.src !== activeUrl) {
          audio.src = activeUrl;
          audio.load();
        }
        await audio.play();
        setIsPlaying(true);
      } catch {
        // If playback failed (e.g. signed URL expired), re-fetch a fresh signed URL and retry once
        const freshUrl = await fetchSignedAudioUrl();
        if (freshUrl && audioRef.current) {
          try {
            audioRef.current.src = freshUrl;
            audioRef.current.load();
            await audioRef.current.play();
            setIsPlaying(true);
          } catch {
            setError(t(language, "audioPlayError"));
            setIsPlaying(false);
          }
        } else {
          setError(t(language, "audioPlayError"));
          setIsPlaying(false);
        }
      }
    }
  };

  const handleReplay = async () => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      setCurrentTime(0);
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        await handleTogglePlay();
      }
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handleError = () => {
      setIsPlaying(false);
      setError(t(language, "audioPlayError"));
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("error", handleError);
    };
  }, [audioUrl, language]);

  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;

  return (
    <div className={styles.audioPlayerWrapper}>
      <audio ref={audioRef} preload="none" />

      <div className={styles.audioPlayerCard}>
        <button
          type="button"
          className={styles.audioPlayButton}
          onClick={handleTogglePlay}
          disabled={loading}
          aria-label={isPlaying ? t(language, "pauseVoice") : t(language, "listenToVoice")}
        >
          {loading ? (
            <MiniSpinner size={16} />
          ) : isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} />
          )}
          <span className={styles.audioButtonText}>
            {isPlaying ? t(language, "pauseVoice") : t(language, "listenToVoice")}
          </span>
        </button>

        <div className={styles.audioWaveform}>
          <div className={styles.audioProgressBar} style={{ width: `${progressPercent}%` }} />
        </div>

        <span className={styles.audioTime}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {currentTime > 0 && (
          <button
            type="button"
            className={styles.audioReplayButton}
            onClick={handleReplay}
            title={t(language, "rerecordVoice")}
            aria-label="Replay"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {error && (
        <p className={styles.audioError} role="alert">
          <AlertCircle size={13} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
