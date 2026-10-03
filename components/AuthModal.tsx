"use client";

import React, { useState } from "react";
import { X, Lock, User as UserIcon, AlertCircle } from "lucide-react";
import type { SafeUser } from "@/lib/auth";
import { t, type Language } from "@/lib/translations";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: SafeUser) => void;
  language: Language;
  initialMode?: "login" | "signup";
  promptReason?: string;
};

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  language,
  initialMode = "login",
  promptReason,
}: Props) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanUser = username.trim();
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(cleanUser)) {
      setError(t(language, "usernameHint"));
      return;
    }

    if (password.length < 6) {
      setError(t(language, "passwordHint"));
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUser, password }),
      });

      const data = (await res.json()) as { user?: SafeUser; error?: string };

      if (!res.ok || !data.user) {
        throw new Error(data.error || "Authentication failed.");
      }

      onSuccess(data.user);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="auth-close"
          type="button"
          onClick={onClose}
          aria-label={t(language, "close")}
        >
          <X size={18} />
        </button>

        <div className="auth-header">
          <div className="auth-mark">B</div>
          <h2>{mode === "login" ? t(language, "login") : t(language, "signup")}</h2>
          {promptReason && <p className="auth-prompt-reason">{promptReason}</p>}
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(""); }}
          >
            {t(language, "login")}
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => { setMode("signup"); setError(""); }}
          >
            {t(language, "signup")}
          </button>
        </div>

        {mode === "signup" && (
          <div className="auth-notice-banner" role="alert">
            <AlertCircle size={15} />
            <span>{t(language, "authNotice")}</span>
          </div>
        )}

        {error && (
          <div className="auth-error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-field-label">{t(language, "usernameLabel")}</span>
            <div className="auth-input-wrap">
              <UserIcon size={15} className="auth-input-icon" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t(language, "usernameHint")}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
              />
            </div>
          </label>

          <label className="auth-field">
            <span className="auth-field-label">{t(language, "passwordLabel")}</span>
            <div className="auth-input-wrap">
              <Lock size={15} className="auth-input-icon" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t(language, "passwordHint")}
                required
              />
            </div>
          </label>

          <button className="auth-submit-button" type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? t(language, "login") : t(language, "signup")}
          </button>

          <div className="auth-switch">
            {mode === "login" ? (
              <button
                type="button"
                className="auth-link-button"
                onClick={() => { setMode("signup"); setError(""); }}
              >
                {t(language, "needAccount")}
              </button>
            ) : (
              <button
                type="button"
                className="auth-link-button"
                onClick={() => { setMode("login"); setError(""); }}
              >
                {t(language, "alreadyHaveAccount")}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
