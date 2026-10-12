"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { detectDevice, STORE_URLS, type Device } from "@/lib/app-open";
import styles from "./open.module.css";
import { Loader2, ArrowLeft, Smartphone } from "lucide-react";

export default function OpenPage() {
  const [device, setDevice] = useState<Device | null>(null);

  useEffect(() => {
    const detected = detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    setDevice(detected);

    // Auto-redirect for desktop users is disabled to allow testing/previewing the UI
    // In production, you might want to re-enable this or leave the beautiful desktop fallback
    if (detected === "other") window.location.replace("/");
  }, []);

  return (
    <main className={styles.main}>
      <div className={styles.backgroundGlow} />

      <div className={styles.card}>
        <div className={styles.logoWrapper}>
          <Image
            src="/images/crest.svg"
            alt="نادي الأنصار"
            width={80}
            height={80}
            priority
            className={styles.logo}
          />
        </div>

        <div className={styles.content}>
          <h1 className={styles.title}>تطبيق الأنصار</h1>
          <p className={styles.subtitle}>الوجهة الرقمية الرسمية لعشاق النادي</p>

          {!device && (
            <div className={styles.loading}>
              <Loader2 className={styles.spinner} />
              <span>جاري التحقق من جهازك...</span>
            </div>
          )}

          {device && device !== "other" && (
            <nav aria-label="خيارات التطبيق" className={styles.actions}>
              <a href="alansar://" className={styles.primaryBtn}>
                <span>فتح التطبيق</span>
              </a>
              <a href={STORE_URLS[device]} className={styles.secondaryBtn}>
                <span>تحميل التطبيق</span>
              </a>
            </nav>
          )}

          {device === "other" && (
            <div className={styles.desktopFallback}>
              <div className={styles.deviceIcon}>
                <Smartphone size={32} />
              </div>
              <p>يرجى فتح هذا الرابط من هاتفك المحمول للحصول على أفضل تجربة.</p>
            </div>
          )}
        </div>

        <a href="/" className={styles.tertiaryLink}>
          <span>الاستمرار إلى المتجر الإلكتروني</span>
          <ArrowLeft size={16} />
        </a>
      </div>
    </main>
  );
}
