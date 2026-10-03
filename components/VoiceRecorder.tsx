"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Play, Pause, RotateCcw, Trash2, AlertCircle } from "lucide-react";
import { t, type Language } from "@/lib/translations";

type Props = {
  language: Language;
  onRecordingChange: (blob: Blob | null, durationMs: number) => void;
  disabled?: boolean;
};

const MAX_DURATION_SECONDS = 30;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024; // 2MB

const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=opus",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function getSupportedMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }
  for (const type of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

export default function VoiceRecorder({ language, onRecordingChange, disabled = false }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up Object URL and MediaStreams on unmount
  const cleanupMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupMedia();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      window.dispatchEvent(new CustomEvent("bloomroom-resume-ambient"));
    };
  }, [cleanupMedia, previewUrl]);

  // Audio preview playback event listeners
  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setPlayProgress(audio.currentTime / audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setPlayProgress(0);
    };
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, [previewUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    cleanupMedia();
    window.dispatchEvent(new CustomEvent("bloomroom-resume-ambient"));
  }, [cleanupMedia]);

  const startRecording = async () => {
    setErrorMessage("");

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      setErrorMessage(t(language, "micUnsupported"));
      return;
    }

    try {
      // Pause ambient audio while recording
      window.dispatchEvent(new CustomEvent("bloomroom-pause-ambient"));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 64000,
      };
      if (mimeType) {
        options.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });

        if (blob.size > MAX_AUDIO_BYTES) {
          setErrorMessage(t(language, "audioTooLarge"));
          deleteRecording();
          return;
        }

        const duration = Math.min(Date.now() - startTimeRef.current, MAX_DURATION_SECONDS * 1000);
        setRecordedDurationMs(duration);
        setRecordedBlob(blob);

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        const nextUrl = URL.createObjectURL(blob);
        setPreviewUrl(nextUrl);

        onRecordingChange(blob, duration);
      };

      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      recorder.start(250); // Collect data every 250ms
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setElapsedSeconds(elapsed);
        if (elapsed >= MAX_DURATION_SECONDS) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      cleanupMedia();
      window.dispatchEvent(new CustomEvent("bloomroom-resume-ambient"));
      console.warn("Could not start recording", err);
      setErrorMessage(t(language, "micDenied"));
    }
  };

  const deleteRecording = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedBlob(null);
    setRecordedDurationMs(0);
    setIsPlaying(false);
    setPlayProgress(0);
    onRecordingChange(null, 0);
  };

  const togglePreview = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setErrorMessage(t(language, "audioPlayError")));
    }
  };

  const formatSeconds = (sec: number) => {
    const rounded = Math.floor(sec);
    const m = Math.floor(rounded / 60);
    const s = rounded % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="voice-recorder-container">
      {/* 1. Initial State: Button to start recording */}
      {!isRecording && !recordedBlob && (
        <button
          type="button"
          className="voice-record-btn"
          onClick={startRecording}
          disabled={disabled}
        >
          <Mic size={15} />
          <span>{t(language, "recordVoice")}</span>
        </button>
      )}

      {/* 2. Recording State: Timer & Stop button */}
      {isRecording && (
        <div className="voice-recording-card" role="status" aria-live="polite">
          <div className="voice-pulse-dot" />
          <span className="voice-timer">
            {formatSeconds(elapsedSeconds)} / {formatSeconds(MAX_DURATION_SECONDS)}
          </span>
          <button
            type="button"
            className="voice-stop-btn"
            onClick={stopRecording}
            aria-label={t(language, "stopRecording")}
          >
            <Square size={13} fill="currentColor" />
            <span>{t(language, "stopRecording")}</span>
          </button>
        </div>
      )}

      {/* 3. Recorded State: Preview Player & Controls */}
      {!isRecording && recordedBlob && previewUrl && (
        <div className="voice-preview-card">
          <audio ref={previewAudioRef} src={previewUrl} preload="auto" />
          <button
            type="button"
            className="voice-play-btn"
            onClick={togglePreview}
            aria-label={isPlaying ? t(language, "pauseVoice") : t(language, "playVoice")}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <div className="voice-wave-bar">
            <div
              className="voice-wave-progress"
              style={{ width: `${Math.round(playProgress * 100)}%` }}
            />
          </div>

          <span className="voice-duration">
            {formatSeconds(recordedDurationMs / 1000)}
          </span>

          <button
            type="button"
            className="voice-icon-btn"
            onClick={startRecording}
            title={t(language, "rerecordVoice")}
            aria-label={t(language, "rerecordVoice")}
          >
            <RotateCcw size={14} />
          </button>

          <button
            type="button"
            className="voice-icon-btn voice-delete-btn"
            onClick={deleteRecording}
            title={t(language, "deleteVoice")}
            aria-label={t(language, "deleteVoice")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Error or permission denied alert */}
      {errorMessage && (
        <div className="voice-error-hint" role="alert">
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
