import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bloomroom — Digital Flower Studio",
  description:
    "A playful spatial flower studio: pick a stem, arrange it in 3D, change the light, add a little wind, and share the result.",
  openGraph: {
    title: "Bloomroom — Digital Flower Studio",
    description: "Pick a stem. Place it. Make a bouquet that moves.",
    type: "website",
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
