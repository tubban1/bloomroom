"use client";

import { useEffect } from "react";

/** Keep dialogs inside the space left by mobile browser chrome and the keyboard. */
export default function VisualViewportSync() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      root.style.setProperty("--dialog-height", `${viewport?.height ?? window.innerHeight}px`);
      root.style.setProperty("--dialog-top", `${viewport?.offsetTop ?? 0}px`);
    };
    const revealInput = () => {
      update();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const input = document.activeElement;
        if ((!viewport || viewport.scale === 1) && input instanceof HTMLElement
          && input.matches('input:not([type="range"]):not([type="color"]), textarea, select')
          && input.closest('.auth-modal, .garden-modal, .finish-card')) {
          input.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        }
      });
    };
    update();
    viewport?.addEventListener("resize", revealInput);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", revealInput);
    document.addEventListener("focusin", revealInput);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", revealInput);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", revealInput);
      document.removeEventListener("focusin", revealInput);
      root.style.removeProperty("--dialog-height");
      root.style.removeProperty("--dialog-top");
    };
  }, []);
  return null;
}
