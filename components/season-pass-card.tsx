import { MapPin } from "lucide-react";
import { formatPassSeat, passPayHref, type MySeasonPassView } from "@/lib/season-pass";
import "./season-pass-card.css";

/** An ACTIVE season pass with its gate QR (SVG rendered server-side by the qrcode library). */
export function SeasonPassCard({ pass }: { pass: MySeasonPassView }) {
  return <article className="sp-card">
    <header className="sp-card-head">
      <span className="sp-card-kicker">التذكرة الموسمية {pass.seasonYear}</span>
      <h2>{pass.tierName}</h2>
      {pass.seat && <p><MapPin size={14} /> {formatPassSeat(pass.seat)}</p>}
    </header>
    {pass.qrSvg
      ? <div className="sp-card-qr" role="img" aria-label={`رمز دخول التذكرة الموسمية ${pass.tierName}`} dangerouslySetInnerHTML={{ __html: pass.qrSvg }} />
      : <p className="sp-card-note">يظهر رمز الدخول بعد تأكيد الدفع.</p>}
    <p className="sp-card-note">اعرض هذا الرمز عند بوابة الملعب في كل مباراة مشمولة بفئتك.</p>
  </article>;
}

/** A season pass waiting for payment (the hold lasts 10 minutes for seated tiers). */
export function SeasonPassPendingCard({ pass }: { pass: MySeasonPassView }) {
  return <article className="sp-card sp-card-pending">
    <header className="sp-card-head">
      <span className="sp-card-kicker">التذكرة الموسمية {pass.seasonYear}</span>
      <h2>{pass.tierName}</h2>
      {pass.seat && <p><MapPin size={14} /> {formatPassSeat(pass.seat)}</p>}
      <p>بانتظار الدفع</p>
    </header>
    <a className="button button-primary" href={passPayHref(pass.id, pass.expiresAt)}>أكمل الدفع</a>
  </article>;
}
