import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://flower.fde.fan"),
  title: "Bloomroom — Digital Flower Studio",
  description:
    "A playful spatial flower studio: pick a stem, arrange it in 3D, change the light, add a little wind, and share the result.",
  keywords: [
    "flower studio",
    "3D flower arrangement",
    "digital bouquet",
    "Three.js",
    "WebGL",
    "ambient soundscapes",
  ],
  authors: [{ name: "Bloomroom" }],
  openGraph: {
    title: "Bloomroom — Digital Flower Studio",
    description: "Pick a stem. Place it. Make a bouquet that moves.",
    url: "https://flower.fde.fan",
    siteName: "Bloomroom",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Bloomroom — Digital Flower Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bloomroom — Digital Flower Studio",
    description: "Pick a stem. Place it. Make a bouquet that moves in 3D.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
