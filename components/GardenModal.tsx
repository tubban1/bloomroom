"use client";

import React, { useEffect, useState } from "react";
import { X, Sparkles, Send, Trash2, Edit3, ArrowRight, ExternalLink, Flower2, Heart } from "lucide-react";
import type { DraftSummary, SentPostcardSummary } from "@/lib/drafts";
import type { SafeUser } from "@/lib/auth";
import { t, type Language } from "@/lib/translations";
import { BloomLoader } from "@/components/BloomLoader";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  user: SafeUser | null;
  onLoadDraft: (draftId: string) => Promise<boolean>;
  onRemixPostcard: (bouquetString: string, toName: string) => boolean;
  onRemixCreation?: (bouquetData: Record<string, unknown>, title: string) => boolean;
  onDraftDeleted?: (draftId: string) => void;
};

export default function GardenModal({
  isOpen,
  onClose,
  language,
  user,
  onLoadDraft,
  onRemixPostcard,
  onRemixCreation,
  onDraftDeleted,
}: Props) {
  const [tab, setTab] = useState<"drafts" | "creations" | "postcards">("drafts");
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [postcards, setPostcards] = useState<SentPostcardSummary[]>([]);
  const [creations, setCreations] = useState<Array<{
    id: string;
    title: string;
    visibility: "public" | "private";
    like_count: number;
    published_at: string;
    image_url: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editingCreationId, setEditingCreationId] = useState<string | null>(null);
  const [editCreationTitle, setEditCreationTitle] = useState("");

  const fetchLibrary = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [libRes, creationsRes] = await Promise.all([
        fetch("/api/user/library", { cache: "no-store" }),
        fetch("/api/user/creations", { cache: "no-store" }),
      ]);
      if (libRes.ok) {
        const data = (await libRes.json()) as { drafts: DraftSummary[]; postcards: SentPostcardSummary[] };
        setDrafts(data.drafts || []);
        setPostcards(data.postcards || []);
      }
      if (creationsRes.ok) {
        const data = (await creationsRes.json()) as { creations: typeof creations };
        setCreations(data.creations || []);
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

  const handleToggleVisibility = async (creationId: string, currentVis: "public" | "private") => {
    const nextVis = currentVis === "public" ? "private" : "public";
    setCreations((prev) =>
      prev.map((c) => (c.id === creationId ? { ...c, visibility: nextVis } : c)),
    );

    try {
      const res = await fetch(`/api/creations/${creationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: nextVis }),
      });
      if (!res.ok) throw new Error("Failed to update visibility");
    } catch {
      setCreations((prev) =>
        prev.map((c) => (c.id === creationId ? { ...c, visibility: currentVis } : c)),
      );
    }
  };

  const handleDeleteCreation = async (creationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t(language, "confirmDeleteCreation"))) return;

    try {
      const res = await fetch(`/api/creations/${creationId}`, { method: "DELETE" });
      if (res.ok) {
        setCreations((prev) => prev.filter((c) => c.id !== creationId));
      }
    } catch {
      // Ignored
    }
  };

  const handleSaveCreationRename = async (creation: { id: string }, e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clean = editCreationTitle.trim();
    if (!clean) return;

    try {
      const res = await fetch(`/api/creations/${creation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: clean }),
      });
      if (res.ok) {
        setCreations((prev) =>
          prev.map((c) => (c.id === creation.id ? { ...c, title: clean } : c)),
        );
      }
    } catch {
      // Ignored
    } finally {
      setEditingCreationId(null);
    }
  };

  const handleRemixCreationItem = async (creationId: string, title: string) => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/creations/${creationId}`);
      if (!res.ok) throw new Error("Could not load bouquet");
      const data = (await res.json()) as { creation: { bouquet_data: Record<string, unknown> } };
      if (!onRemixCreation?.(data.creation.bouquet_data, title)) throw new Error("Invalid bouquet");
      onClose();
    } catch {
      setLoadError(true);
    }
  };

  const handleLoadDraftItem = async (id: string) => {
    setLoadError(false);
    if (await onLoadDraft(id)) onClose();
    else setLoadError(true);
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
            className={`garden-tab ${tab === "creations" ? "active" : ""}`}
            onClick={() => setTab("creations")}
          >
            {t(language, "myCreations")} ({creations.length})
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
          {loadError && <p role="alert">{t(language, "loadBouquetError")}</p>}
          {loading ? (
            <div className="garden-empty-state" role="status">
              <BloomLoader size="md" label={t(language, "loading")} />
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
                    <div className="garden-card-preview" onClick={draft.editable === false ? undefined : () => handleLoadDraftItem(draft.id)}>
                      {draft.preview_image ? (
                        <img src={draft.preview_image} alt={draft.title} />
                      ) : (
                        <div className="garden-card-placeholder">
                          <Flower2 size={32} />
                        </div>
                      )}
                    </div>
                    <div className="garden-card-body">
                      <span className="garden-card-date">{formatDate(draft.updated_at)}</span>
                      {draft.editable === false && <p>{t(language, "draftDataMissing")}</p>}
                      <div className="garden-card-actions">
                        {draft.editable !== false && <button
                          type="button"
                          className="garden-action-primary"
                          onClick={() => handleLoadDraftItem(draft.id)}
                        >
                          <span>{t(language, "continueEdit")}</span>
                          <ArrowRight size={13} />
                        </button>}
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
          ) : tab === "creations" ? (
            creations.length === 0 ? (
              <div className="garden-empty-state">
                <Flower2 size={36} className="garden-empty-icon" />
                <p>{t(language, "noCreations")}</p>
              </div>
            ) : (
              <div className="garden-grid">
                {creations.map((c) => (
                  <article key={c.id} className="garden-card creation-card">
                    <div
                      className="garden-card-preview"
                      onClick={() => handleRemixCreationItem(c.id, c.title)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.image_url} alt={c.title} />
                      <div className="garden-card-tag-row">
                        <span className={`garden-vis-pill ${c.visibility}`}>
                          {c.visibility === "public" ? t(language, "publicBadge") : t(language, "privateBadge")}
                        </span>
                      </div>
                    </div>

                    <div className="garden-card-body">
                      <div className="garden-creation-meta-row">
                        <span className="garden-card-date">{formatDate(c.published_at)}</span>
                        {c.like_count > 0 && (
                          <span className="garden-creation-likes">
                            <Heart size={12} fill="#e25555" color="#e25555" />
                            {c.like_count}
                          </span>
                        )}
                      </div>

                      <div className="garden-card-actions">
                        <button
                          type="button"
                          className="garden-action-vis-toggle"
                          onClick={() => handleToggleVisibility(c.id, c.visibility)}
                          title={c.visibility === "public" ? t(language, "setPrivate") : t(language, "setPublic")}
                        >
                          {c.visibility === "public" ? t(language, "setPrivate") : t(language, "setPublic")}
                        </button>
                        <button
                          type="button"
                          className="garden-action-primary"
                          onClick={() => handleRemixCreationItem(c.id, c.title)}
                          title={t(language, "remixCopy")}
                        >
                          <span>{t(language, "remixCopy")}</span>
                          <ArrowRight size={13} />
                        </button>
                        <button
                          type="button"
                          className="garden-action-delete"
                          onClick={(e) => handleDeleteCreation(c.id, e)}
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
                        onClick={() => { if (onRemixPostcard(pc.bouquet, pc.to_name)) onClose(); else setLoadError(true); }}
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
