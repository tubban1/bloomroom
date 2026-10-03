"use client";

import React, { useEffect, useState } from "react";
import { X, Sparkles, Send, Trash2, Edit3, ArrowRight, ExternalLink, Flower2 } from "lucide-react";
import type { DraftSummary, SentPostcardSummary } from "@/lib/drafts";
import type { SafeUser } from "@/lib/auth";
import { t, type Language } from "@/lib/translations";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  user: SafeUser | null;
  onLoadDraft: (draftId: string) => void;
  onRemixPostcard: (bouquetString: string, toName: string) => void;
  onDraftDeleted?: (draftId: string) => void;
};

export default function GardenModal({
  isOpen,
  onClose,
  language,
  user,
  onLoadDraft,
  onRemixPostcard,
  onDraftDeleted,
}: Props) {
  const [tab, setTab] = useState<"drafts" | "postcards">("drafts");
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [postcards, setPostcards] = useState<SentPostcardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const fetchLibrary = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/user/library", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { drafts: DraftSummary[]; postcards: SentPostcardSummary[] };
        setDrafts(data.drafts || []);
        setPostcards(data.postcards || []);
      }
    } catch {
      // Gracefully handle network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchLibrary();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t(language, "confirmDelete"))) return;

    try {
      const res = await fetch(`/api/user/drafts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDrafts((current) => current.filter((d) => d.id !== id));
        onDraftDeleted?.(id);
      }
    } catch {
      // Ignored
    }
  };

  const handleStartRename = (draft: DraftSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDraftId(draft.id);
    setEditTitle(draft.title);
  };

  const handleSaveRename = async (draft: DraftSummary, e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clean = editTitle.trim();
    if (!clean) return;

    try {
      const res = await fetch(`/api/user/drafts/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: clean }),
      });
      if (res.ok) {
        setDrafts((current) =>
          current.map((d) => (d.id === draft.id ? { ...d, title: clean } : d)),
        );
      }
    } catch {
      // Ignored
    } finally {
      setEditingDraftId(null);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(language === "zh" ? "zh-CN" : language, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="garden-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="garden-modal" onClick={(e) => e.stopPropagation()}>
        <header className="garden-header">
          <div className="garden-header-title">
            <span className="garden-badge"><Sparkles size={14} /></span>
            <div>
              <h2>{t(language, "myGarden")}</h2>
              <span className="garden-user-label">@{user?.username}</span>
            </div>
          </div>
          <button
            className="garden-close"
            type="button"
            onClick={onClose}
            aria-label={t(language, "close")}
          >
            <X size={18} />
          </button>
        </header>

        <div className="garden-tabs" role="tablist">
          <button
            type="button"
            className={`garden-tab ${tab === "drafts" ? "active" : ""}`}
            onClick={() => setTab("drafts")}
          >
            {t(language, "drafts")} ({drafts.length})
          </button>
          <button
            type="button"
            className={`garden-tab ${tab === "postcards" ? "active" : ""}`}
            onClick={() => setTab("postcards")}
          >
            {t(language, "sentPostcards")} ({postcards.length})
          </button>
        </div>

        <div className="garden-content">
          {loading ? (
            <div className="garden-empty-state">
              <p>{t(language, "loading")}</p>
            </div>
          ) : tab === "drafts" ? (
            drafts.length === 0 ? (
              <div className="garden-empty-state">
                <Flower2 size={36} className="garden-empty-icon" />
                <p>{t(language, "noDrafts")}</p>
              </div>
            ) : (
              <div className="garden-grid">
                {drafts.map((draft) => (
                  <article key={draft.id} className="garden-card draft-card">
                    <div className="garden-card-preview" onClick={() => { onLoadDraft(draft.id); onClose(); }}>
                      {draft.preview_image ? (
                        <img src={draft.preview_image} alt={draft.title} />
                      ) : (
                        <div className="garden-card-placeholder">
                          <Flower2 size={32} />
                        </div>
                      )}
                    </div>
                    <div className="garden-card-body">
                      {editingDraftId === draft.id ? (
                        <form className="garden-rename-form" onSubmit={(e) => handleSaveRename(draft, e)}>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            maxLength={64}
                            autoFocus
                            onBlur={(e) => handleSaveRename(draft, e)}
                          />
                        </form>
                      ) : (
                        <div className="garden-card-title-row">
                          <h3 title={draft.title}>{draft.title}</h3>
                          <button
                            type="button"
                            className="garden-inline-rename"
                            onClick={(e) => handleStartRename(draft, e)}
                            title={t(language, "rename")}
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      )}
                      <span className="garden-card-date">{formatDate(draft.updated_at)}</span>
                      <div className="garden-card-actions">
                        <button
                          type="button"
                          className="garden-action-primary"
                          onClick={() => { onLoadDraft(draft.id); onClose(); }}
                        >
                          <span>{t(language, "continueEdit")}</span>
                          <ArrowRight size={13} />
                        </button>
                        <button
                          type="button"
                          className="garden-action-danger"
                          onClick={(e) => handleDeleteDraft(draft.id, e)}
                          title={t(language, "deleteAction")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : postcards.length === 0 ? (
            <div className="garden-empty-state">
              <Send size={36} className="garden-empty-icon" />
              <p>{t(language, "noSentPostcards")}</p>
            </div>
          ) : (
            <div className="garden-grid">
              {postcards.map((pc) => (
                <article key={pc.id} className="garden-card postcard-card">
                  <div className="garden-card-preview">
                    <img src={`/api/postcards/${pc.id}/image`} alt={pc.to_name || "Gift"} />
                  </div>
                  <div className="garden-card-body">
                    <h3 title={pc.to_name ? `${t(language, "toName")} ${pc.to_name}` : t(language, "postcardTitle")}>
                      {pc.to_name ? `${t(language, "toName")} ${pc.to_name}` : t(language, "postcardTitle")}
                    </h3>
                    <p className="garden-card-note">{pc.message || t(language, "defaultMessage")}</p>
                    <span className="garden-card-date">{formatDate(pc.created_at)}</span>
                    <div className="garden-card-actions">
                      <button
                        type="button"
                        className="garden-action-primary"
                        onClick={() => { onRemixPostcard(pc.bouquet, pc.to_name); onClose(); }}
                        title={t(language, "remixCopy")}
                      >
                        <span>{t(language, "remixCopy")}</span>
                        <ArrowRight size={13} />
                      </button>
                      <a
                        href={`/g/${pc.id}?lang=${language}`}
                        target="_blank"
                        rel="noreferrer"
                        className="garden-action-link"
                        title={t(language, "viewGift")}
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
