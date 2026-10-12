"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { appLaunchUrl, detectDevice, STORE_URLS, type Device } from "@/lib/app-open";
import styles from "./open.module.css";
import { Loader2, ArrowLeft, Smartphone } from "lucide-react";

export default function OpenPage() {
  const [device, setDevice] = useState<Device | null>(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    const detected = detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    setDevice(detected);

    if (detected === "other") {
      window.location.replace("/");
      return;
    }

    // Coming back from the store or the app: show the buttons instead of bouncing again.
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "back_forward") return;

    // Reaching this page means the OS did not hand the link to the app (not installed, or an
    // installed build without verified links). Try the app, then send the user to the store if
    // the page is still in front.
    setLaunching(true);
    const fallback = window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.href = STORE_URLS[detected];
      setLaunching(false);
    }, 1800);
    const cancel = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(fallback);
        setLaunching(false);
      }
    };
    document.addEventListener("visibilitychange", cancel);
    window.addEventListener("pagehide", cancel);
    window.location.href = appLaunchUrl(detected);

    return () => {
      window.clearTimeout(fallback);
      document.removeEventListener("visibilitychange", cancel);
      window.removeEventListener("pagehide", cancel);
    };
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

          {launching && (
            <div className={styles.loading}>
              <Loader2 className={styles.spinner} />
              <span>جاري فتح التطبيق...</span>
            </div>
          )}

          {device && device !== "other" && !launching && (
            <nav aria-label="خيارات التطبيق" className={styles.actions}>
              <a href={appLaunchUrl(device)} className={styles.primaryBtn}>
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
