"use client";

import { useEffect, useState } from "react";
import { BadgePercent, Bell, Gem, Ticket } from "lucide-react";
import { detectDevice, storeBadgesFor, STORE_URLS, type Device } from "@/lib/app-open";
import "./app-promo.css";

const FEATURES = [
  { icon: Ticket, text: "تذاكر المباريات وتذكرة الموسم في محفظة جوالك" },
  { icon: BadgePercent, text: "خصم العضوية يُطبَّق تلقائيًا على مشترياتك" },
  { icon: Gem, text: "نقاط ولاء تستبدلها بمكافآت" },
  { icon: Bell, text: "تنبيهات بالعروض والأخبار ونتائج المباريات أولًا بأول" },
];

// Official Arabic badges from Apple and Google; their artwork must not be altered.
const BADGES = {
  ios: { src: "/images/badges/app-store-ar.svg", alt: "تنزيل من App Store", width: 120, height: 40 },
  android: { src: "/images/badges/google-play-ar.png", alt: "احصل عليه من Google Play", width: 155, height: 60 },
} as const;

/** Server renders both badges; after mount a phone keeps only its own store. Desktop also gets a QR code to /open. */
export function AppPromo() {
  const [device, setDevice] = useState<Device | null>(null);

  useEffect(() => {
    setDevice(detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints));
  }, []);

  const onPhone = device === "ios" || device === "android";

  return <section className="app-promo" aria-labelledby="app-promo-title">
    <div className="app-promo-inner section-shell">
      <div className="app-promo-content">
        <span className="section-kicker">تطبيق الأنصار</span>
        <h2 id="app-promo-title">النادي كله<br />في جيبك<span className="heading-dot">.</span></h2>
        <p className="app-promo-lede">تذاكرك ومشترياتك ومكافآتك في مكان واحد.</p>
        <ul className="app-promo-features">
          {FEATURES.map(({ icon: Icon, text }) => <li key={text}><Icon aria-hidden="true" />{text}</li>)}
        </ul>
        <div className="app-promo-badges">
          {storeBadgesFor(device).map(store => <a key={store} className={`app-badge app-badge-${store}`} href={STORE_URLS[store]} target="_blank" rel="noopener noreferrer">
            <img src={BADGES[store].src} alt={BADGES[store].alt} width={BADGES[store].width} height={BADGES[store].height} loading="lazy" />
          </a>)}
        </div>
      </div>
      <div className={`app-promo-visual${onPhone ? " on-phone" : ""}`}>
        <img className="app-promo-icon" src="/images/app-icon.png" alt="أيقونة تطبيق الأنصار" width="192" height="192" loading="lazy" />
        {!onPhone && <figure className="app-promo-qr">
          <img src="/images/app-qr.svg" alt="رمز QR لتحميل تطبيق الأنصار" width="112" height="112" loading="lazy" />
          <figcaption>امسح الرمز<br />بكاميرا جوالك</figcaption>
        </figure>}
      </div>
    </div>
  </section>;
}
