"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  X,
  Heart,
  Sparkles,
  RotateCcw,
  Clock,
  Compass,
  Eye,
  Check,
  Flame,
} from "lucide-react";
import { BloomLoader, MiniSpinner } from "@/components/BloomLoader";
import { t, type Language } from "@/lib/translations";
import type { SafeUser } from "@/lib/auth";
import type { CreationCard, CreationDetail, GallerySort } from "@/lib/creations";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currentUser?: SafeUser | null;
  onRemixCreation: (bouquetData: unknown, title?: string) => boolean | void;
  onView3dBouquet?: (bouquetData: any, title?: string) => void;
};

export default function GalleryModal({
  isOpen,
  onClose,
  language,
  currentUser,
  onRemixCreation,
  onView3dBouquet,
}: Props) {
  const [sort, setSort] = useState<GallerySort>("latest");
  const [items, setItems] = useState<CreationCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Detail Modal
  const [selectedItem, setSelectedItem] = useState<CreationCard | null>(null);
  const [detail, setDetail] = useState<CreationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const overlayMouseDownRef = useRef<EventTarget | null>(null);
  const detailMouseDownRef = useRef<EventTarget | null>(null);

  const fetchItems = useCallback(async (newSort: GallerySort, newOffset: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/gallery?sort=${newSort}&offset=${newOffset}&limit=18`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          items: CreationCard[];
          total: number;
          hasMore: boolean;
          offset: number;
        };
        if (append) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newItems = data.items.filter((i) => !existingIds.has(i.id));
            return [...prev, ...newItems];
          });
        } else {
          setItems(data.items || []);
        }
        setTotal(data.total || 0);
        setHasMore(Boolean(data.hasMore));
        setOffset(newOffset);
      }
    } catch (err) {
      console.error("Failed to fetch gallery:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchItems(sort, 0, false);
    }
  }, [isOpen, sort, fetchItems]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedItem) {
          handleCloseDetail();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedItem, onClose]);

  const handleSortChange = (newSort: GallerySort) => {
    if (newSort === sort) return;
    setSort(newSort);
    setOffset(0);
    fetchItems(newSort, 0, false);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    const nextOffset = offset + 18;
    fetchItems(sort, nextOffset, true);
  };

  const handleToggleLike = async (creationId: string, currentLiked: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Optimistic update on card
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== creationId) return item;
        const nextLiked = !currentLiked;
        const nextCount = nextLiked ? item.like_count + 1 : Math.max(0, item.like_count - 1);
        return { ...item, liked: nextLiked, like_count: nextCount };
      }),
    );

    if (detail && detail.id === creationId) {
      const nextLiked = !currentLiked;
      const nextCount = nextLiked ? detail.like_count + 1 : Math.max(0, detail.like_count - 1);
      setDetail({ ...detail, liked: nextLiked, like_count: nextCount });
    }

    try {
      const method = currentLiked ? "DELETE" : "POST";
      const res = await fetch(`/api/gallery/${creationId}/like`, { method });
      if (!res.ok) {
        throw new Error("Like request failed");
      }
      const data = (await res.json()) as { like_count: number; liked: boolean };
      // Sync actual count from server response
      setItems((prev) =>
        prev.map((item) =>
          item.id === creationId ? { ...item, liked: data.liked, like_count: data.like_count } : item,
        ),
      );
      if (detail && detail.id === creationId) {
        setDetail((d) => (d ? { ...d, liked: data.liked, like_count: data.like_count } : null));
      }
    } catch {
      // Revert optimistic update on failure
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== creationId) return item;
          return { ...item, liked: currentLiked, like_count: currentLiked ? item.like_count + 1 : Math.max(0, item.like_count - 1) };
        }),
      );
    }
  };

  const handleOpenDetail = async (card: CreationCard) => {
    setSelectedItem(card);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/creations/${card.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { creation: CreationDetail };
        setDetail(data.creation);
      } else {
        setDetail(null);
      }
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedItem(null);
    setDetail(null);
  };

  const handleRemix = (targetDetail: CreationDetail) => {
    if (onRemixCreation(targetDetail.bouquet_data, targetDetail.title) === false) return;
    handleCloseDetail();
    onClose();
  };

  const handleView3d = (targetDetail: CreationDetail) => {
    if (onView3dBouquet) {
      onView3dBouquet(targetDetail.bouquet_data, targetDetail.title);
      handleCloseDetail();
      onClose();
    } else {
      handleRemix(targetDetail);
    }
  };

  const formatPublishDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="gallery-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t(language, "galleryTitle")}
      onMouseDown={(e) => {
        overlayMouseDownRef.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && overlayMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="gallery-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="gallery-header">
          <div className="gallery-header-left">
            <div className="gallery-title-wrap">
              <Compass size={18} className="gallery-header-icon" />
              <h2 className="gallery-title">{t(language, "galleryTitle")}</h2>
            </div>
            <p className="gallery-subtitle">{t(language, "gallerySubtitle")}</p>
          </div>

          <div className="gallery-header-controls">
            <div className="gallery-sort-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={sort === "latest"}
                className={`gallery-sort-btn ${sort === "latest" ? "active" : ""}`}
                onClick={() => handleSortChange("latest")}
              >
                <Clock size={13} />
                <span>{t(language, "latest")}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sort === "popular"}
                className={`gallery-sort-btn ${sort === "popular" ? "active" : ""}`}
                onClick={() => handleSortChange("popular")}
              >
                <Flame size={13} />
                <span>{t(language, "popular")}</span>
              </button>
            </div>

            <button
              type="button"
              className="gallery-close-btn"
              onClick={onClose}
              aria-label={t(language, "close")}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="gallery-body">
          {loading && (
            <div className="gallery-loading-state">
              <BloomLoader size="md" label={t(language, "loadingMore")} />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="gallery-empty-state">
              <Sparkles size={32} className="gallery-empty-icon" />
              <p>{t(language, "emptyGallery")}</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <>
              <div className="gallery-grid">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="gallery-card"
                    onClick={() => handleOpenDetail(item)}
                  >
                    <div className="gallery-card-thumb-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image_url}
                        alt=""
                        loading="lazy"
                        className="gallery-card-thumb"
                      />
                      <button
                        type="button"
                        className={`gallery-card-like-btn ${item.liked ? "liked" : ""}`}
                        onClick={(e) => handleToggleLike(item.id, item.liked, e)}
                        title={item.liked ? t(language, "likedAction") : t(language, "likeAction")}
                        aria-label={item.liked ? t(language, "likedAction") : t(language, "likeAction")}
                      >
                        <Heart size={14} fill={item.liked ? "#e25555" : "none"} />
                        <span>{item.like_count > 0 ? item.like_count : ""}</span>
                      </button>
                    </div>

                    <div className="gallery-card-meta">
                      <div className="gallery-card-sub">
                        {item.author_name && item.author_name !== "匿名花友" && item.author_name !== t(language, "anonymousFlorist") ? (
                          <span className="gallery-card-author">{item.author_name}</span>
                        ) : null}
                        <span className="gallery-card-date">{formatPublishDate(item.published_at)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {hasMore && (
                <div className="gallery-load-more-wrap">
                  <button
                    type="button"
                    className="gallery-load-more-btn"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <MiniSpinner size={14} />
                        <span>{t(language, "loadingMore")}</span>
                      </>
                    ) : (
                      <span>{t(language, "loadMore")}</span>
                    )}
                  </button>
                </div>
              )}

              {!hasMore && items.length >= 18 && (
                <div className="gallery-all-loaded">
                  <span>{t(language, "allLoaded")}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Artwork Detail Modal */}
        {selectedItem && (
          <div
            className="gallery-detail-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={t(language, "galleryTitle")}
            onMouseDown={(e) => {
              detailMouseDownRef.current = e.target;
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && detailMouseDownRef.current === e.currentTarget) {
                handleCloseDetail();
              }
            }}
          >
            <div className="gallery-detail-card" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="gallery-detail-close"
                onClick={handleCloseDetail}
                aria-label={t(language, "close")}
              >
                <X size={18} />
              </button>

              <div className="gallery-detail-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedItem.image_url}
                  alt=""
                  className="gallery-detail-img"
                />
              </div>

              <div className="gallery-detail-info">
                <div className="gallery-detail-header">
                  <div>
                    <p className="gallery-detail-author">
                      {selectedItem.author_name && selectedItem.author_name !== "匿名花友" && selectedItem.author_name !== t(language, "anonymousFlorist")
                        ? `${selectedItem.author_name} · ${formatPublishDate(selectedItem.published_at)}`
                        : formatPublishDate(selectedItem.published_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`gallery-detail-like-btn ${selectedItem.liked ? "liked" : ""}`}
                    onClick={() => handleToggleLike(selectedItem.id, selectedItem.liked)}
                  >
                    <Heart size={16} fill={selectedItem.liked ? "#e25555" : "none"} />
                    <span>{selectedItem.like_count}</span>
                  </button>
                </div>

                <div className="gallery-detail-actions">
                  <button
                    type="button"
                    className="gallery-action-primary"
                    onClick={() => {
                      if (detail) handleRemix(detail);
                      else handleOpenDetail(selectedItem);
                    }}
                    disabled={detailLoading}
                  >
                    <RotateCcw size={14} />
                    <span>{t(language, "remixCreation")}</span>
                  </button>

                  <button
                    type="button"
                    className="gallery-action-secondary"
                    onClick={() => {
                      if (detail) handleView3d(detail);
                    }}
                    disabled={detailLoading}
                  >
                    <Eye size={14} />
                    <span>{t(language, "view3dBouquet")}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
