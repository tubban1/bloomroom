import React from "react";

export type BloomLoaderSize = "sm" | "md" | "lg";

export interface BloomLoaderProps {
  size?: BloomLoaderSize;
  label?: string;
  sublabel?: string;
  className?: string;
  color?: string;
}

/**
 * Botanical bloom loader that features gentle unfolding petals and a breathing rhythm.
 * Designed specifically for Bloomroom with pure CSS animations and minimal DOM footprint.
 */
export function BloomLoader({
  size = "md",
  label,
  sublabel,
  className = "",
  color,
}: BloomLoaderProps) {
  return (
    <div
      className={`bloom-loader-container size-${size} ${className}`}
      style={color ? { color } : undefined}
      role="status"
    >
      <svg
        viewBox="0 0 48 48"
        className="bloom-flower-svg"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        {/* Central slender stem */}
        <path
          d="M 24 44 C 23.6 34 23.2 24 24 14"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="bloom-stem"
        />

        {/* Left leaf */}
        <path
          d="M 24 33 C 15 31 12 23 20 21 C 23 20.5 23.8 26 24 33"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="bloom-leaf-l"
          fill="currentColor"
          fillOpacity="0.06"
        />

        {/* Right leaf */}
        <path
          d="M 24 27 C 33 25 36 17 28 15 C 25 14.5 24.2 20 24 27"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="bloom-leaf-r"
          fill="currentColor"
          fillOpacity="0.06"
        />

        {/* Blossoming petals */}
        <g className="bloom-petals-group">
          {/* Center petal */}
          <path
            d="M 24 15 C 20.5 9 17 10 20.5 5 C 23 1.5 25 1.5 27.5 5 C 31 10 27.5 9 24 15 Z"
            strokeWidth="1.4"
            strokeLinejoin="round"
            className="bloom-petal-center"
            fill="currentColor"
            fillOpacity="0.1"
          />

          {/* Left petal */}
          <path
            d="M 24 15 C 16.5 13.5 12 7.5 18 3.5 C 21.5 1 24 8 24 15 Z"
            strokeWidth="1.3"
            strokeLinejoin="round"
            className="bloom-petal-left"
            fill="currentColor"
            fillOpacity="0.07"
          />

          {/* Right petal */}
          <path
            d="M 24 15 C 31.5 13.5 36 7.5 30 3.5 C 26.5 1 24 8 24 15 Z"
            strokeWidth="1.3"
            strokeLinejoin="round"
            className="bloom-petal-right"
            fill="currentColor"
            fillOpacity="0.07"
          />
        </g>

        {/* Center dew / glowing core */}
        <circle cx="24" cy="9" r="1.5" className="bloom-core" fill="currentColor" />
      </svg>

      {label && <p className="bloom-loader-label">{label}</p>}
      {sublabel && <p className="bloom-loader-sublabel">{sublabel}</p>}
    </div>
  );
}

/**
 * Micro ring spinner for buttons, inline actions, and compact loading states.
 */
export function MiniSpinner({
  size = 14,
  className = "",
  color,
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`bloom-spinner-ring ${className}`}
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="2.5"
      />
      <path
        d="M12 3 a 9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
