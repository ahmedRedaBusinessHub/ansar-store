"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { androidProductIntentUrl, detectDevice } from "@/lib/app-open";

const DISMISS_KEY = "ansar-store:app-banner-dismissed";

/** Android only. iOS gets Safari's native Smart App Banner from the `itunes` metadata in app/products/[id]/page.tsx. */
export function AppBanner({ productId }: { productId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { /* storage blocked: show the banner */ }
    setVisible(!dismissed && detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) === "android");
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage blocked: hide for this view only */ }
    setVisible(false);
  };

  return <aside className="pd-banner" aria-label="تطبيق الأنصار">
    <span>تصفّح هذا المنتج في تطبيق الأنصار</span>
    <a href={androidProductIntentUrl(productId)}>فتح في التطبيق</a>
    <button type="button" aria-label="إغلاق" title="إغلاق" onClick={dismiss}><X size={18} /></button>
  </aside>;
}
