import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getPostcard } from "@/lib/postcards";
import { t, type Language } from "@/lib/translations";
import PostcardAudioPlayer from "@/components/PostcardAudioPlayer";
import styles from "./page.module.css";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ lang?: string }> };
const languages: Language[] = ["zh", "en", "de", "fr"];

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

export default async function PostcardPage({ params, searchParams }: Props) {
  const postcard = await findPostcard(params);
  if (!postcard) notFound();
  const query = searchParams ? await searchParams : undefined;
  const language = languages.includes(query?.lang as Language) ? query?.lang as Language : "en";
  const shareUrl = `https://flower.fde.fan/g/${postcard.id}?lang=${language}`;
  const qrImage = await QRCode.toDataURL(shareUrl, { errorCorrectionLevel: "Q", width: 160, margin: 4 });

  return <main className={styles.page} lang={language === "zh" ? "zh-CN" : language}>
    <header className={styles.header}>
      <Link className={styles.brand} href={`/?lang=${language}`}>B <span>Bloomroom</span></Link>
      <span>{t(language, "brand")}</span>
    </header>
    <article className={styles.postcard} aria-label={t(language, "postcardTitle")}>
      <div className={styles.photo}>
        <Image src={`/api/postcards/${postcard.id}/image`} alt={t(language, "postcardTitle")} width={1200} height={800} unoptimized priority />
      </div>
      <div className={styles.message}>
        <p className={styles.kicker}>{t(language, "postcardKicker")}</p>
        {postcard.to_name && <p className={styles.to}>{t(language, "toName")} {postcard.to_name},</p>}
        <p className={styles.note}>{postcard.message || t(language, "defaultMessage")}</p>
        {postcard.audio_path ? (
          <PostcardAudioPlayer
            postcardId={postcard.id}
            language={language}
            initialDurationMs={postcard.audio_duration_ms}
          />
        ) : null}
        <div className={styles.footer}>
          {postcard.from_name && <p className={styles.from}>{t(language, "fromName")} {postcard.from_name}</p>}
          <a className={styles.qrLink} href={shareUrl} aria-label={shareUrl}>
            <Image src={qrImage} alt={`QR code for ${shareUrl}`} width={104} height={104} unoptimized />
            <span>flower.fde.fan/g/{postcard.id}</span>
          </a>
        </div>
      </div>
    </article>
    <nav className={styles.actions} aria-label={t(language, "postcardTitle")}>
      <Link href={`/?lang=${language}#b=${postcard.bouquet}`}>{t(language, "openBouquet")} <span aria-hidden="true">↗</span></Link>
      <Link href={`/?lang=${language}`}>{t(language, "createBouquet")} <span aria-hidden="true">↗</span></Link>
    </nav>
  </main>;
}
