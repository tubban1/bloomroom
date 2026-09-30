import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostcard } from "@/lib/postcards";
import styles from "./page.module.css";

type Props = { params: Promise<{ id: string }> };

async function findPostcard(params: Props["params"]) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{12}$/.test(id)) return null;
  return getPostcard(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const postcard = await findPostcard(params);
  if (!postcard) return { title: "Postcard not found — Bloomroom" };
  const title = postcard.to_name ? `Flowers for ${postcard.to_name} — Bloomroom` : "Flowers for you — Bloomroom";
  const description = postcard.message || "A bouquet made for you in Bloomroom.";
  return {
    title,
    description,
    metadataBase: new URL("https://flower.fde.fan"),
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `/api/postcards/${postcard.id}/image`, width: 1200, height: 800, alt: "A personal flower postcard" }],
    },
  };
}

export default async function PostcardPage({ params }: Props) {
  const postcard = await findPostcard(params);
  if (!postcard) notFound();

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/">B <span>Bloomroom</span></Link>
      <span>Digital flower studio</span>
    </header>
    <article className={styles.postcard} aria-label="Flower postcard">
      <div className={styles.photo}>
        <Image src={`/api/postcards/${postcard.id}/image`} alt="A bouquet arranged for this postcard" width={1200} height={800} unoptimized priority />
      </div>
      <div className={styles.message}>
        <p className={styles.kicker}>A little something for you</p>
        {postcard.to_name && <p className={styles.to}>To {postcard.to_name},</p>}
        <p className={styles.note}>{postcard.message || "May your day bloom in its own way."}</p>
        {postcard.from_name && <p className={styles.from}>From {postcard.from_name}</p>}
      </div>
    </article>
    <nav className={styles.actions} aria-label="Postcard actions">
      <Link href={`/#b=${postcard.bouquet}`}>See this bouquet in the studio <span aria-hidden="true">↗</span></Link>
      <Link href="/">Make your own bouquet <span aria-hidden="true">↗</span></Link>
    </nav>
  </main>;
}
