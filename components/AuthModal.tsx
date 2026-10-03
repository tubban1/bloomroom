"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Lock, Eye, EyeOff, User as UserIcon, AlertCircle } from "lucide-react";
import type { SafeUser } from "@/lib/auth";
import { t, type Language } from "@/lib/translations";
import { MiniSpinner } from "@/components/BloomLoader";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: SafeUser) => void;
  language: Language;
  initialMode?: "login" | "signup";
  promptReason?: string;
};

function PasswordField({ id, label, value, onChange, language, mode }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  language: Language;
  mode: "login" | "signup";
}) {
  const [visible, setVisible] = useState(false);
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const mask = () => {
    if (timer.current) clearTimeout(timer.current);
    setTyping(false);
  };

  return (
    <div className="auth-field">
      <label className="auth-field-label" htmlFor={id}>{label}</label>
      <div className="auth-input-wrap auth-password-wrap">
        <Lock size={15} className="auth-input-icon" aria-hidden="true" />
        <input
          id={id}
          type={visible || typing ? "text" : "password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            if (timer.current) clearTimeout(timer.current);
            setTyping(Boolean(event.target.value));
            timer.current = setTimeout(() => setTyping(false), 800);
          }}
          onBlur={mask}
          placeholder={t(language, id === "auth-confirm-password" ? "confirmPasswordHint" : "passwordHint")}
          required
        />
        <button
          className="auth-password-toggle"
          type="button"
          aria-label={t(language, visible ? "hidePassword" : "showPassword")}
          title={t(language, visible ? "hidePassword" : "showPassword")}
          aria-pressed={visible}
          onClick={() => { mask(); setVisible(!visible); }}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalRef.current?.focus();
    return () => {
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const closeModal = () => {
    setPassword("");
    setConfirmPassword("");
    setError("");
    onClose();
  };
  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setConfirmPassword("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanUser = username.trim();
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(cleanUser)) {
      setError(t(language, "usernameHint"));
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError(t(language, "passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUser, password, ...(mode === "signup" ? { confirmPassword } : {}) }),
      });

      const data = (await res.json()) as { user?: SafeUser; error?: string };

      if (!res.ok || !data.user) {
        throw new Error(data.error || "Authentication failed.");
      }

      onSuccess(data.user);
      closeModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={closeModal}>
      <div
        ref={modalRef}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); closeModal(); }
          if (event.key !== "Tab") return;
          const controls = modalRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)");
          if (!controls?.length) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
          }
        }}
      >
        <button
          className="auth-close"
          type="button"
          onClick={closeModal}
          aria-label={t(language, "close")}
        >
          <X size={18} />
        </button>

        <div className="auth-header">
          <div className="auth-mark">B</div>
          <h2 id="auth-title">{mode === "login" ? t(language, "login") : t(language, "signup")}</h2>
          {promptReason && <p className="auth-prompt-reason">{promptReason}</p>}
        </div>

        <div className="auth-tabs" role="group" aria-label={t(language, "login")}>
          <button
            type="button"
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            aria-pressed={mode === "login"}
            onClick={() => switchMode("login")}
          >
            {t(language, "login")}
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            aria-pressed={mode === "signup"}
            onClick={() => switchMode("signup")}
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
                autoComplete="username"
                maxLength={32}
              />
            </div>
          </label>

          <PasswordField key={`${isOpen}:${mode}`} id="auth-password" label={t(language, "passwordLabel")} value={password} onChange={setPassword} language={language} mode={mode} />
          {mode === "signup" && <PasswordField id="auth-confirm-password" label={t(language, "confirmPasswordLabel")} value={confirmPassword} onChange={setConfirmPassword} language={language} mode={mode} />}

          <button className="auth-submit-button" type="submit" disabled={loading}>
            {loading ? <MiniSpinner size={16} /> : mode === "login" ? t(language, "login") : t(language, "signup")}
          </button>

          <div className="auth-switch">
            {mode === "login" ? (
              <button
                type="button"
                className="auth-link-button"
                onClick={() => switchMode("signup")}
              >
                {t(language, "needAccount")}
              </button>
            ) : (
              <button
                type="button"
                className="auth-link-button"
                onClick={() => switchMode("login")}
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
