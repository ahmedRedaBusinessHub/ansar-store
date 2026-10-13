"use client";

export default function MatchError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="initial-state">
    <img src="/images/logo.svg" alt="نادي الأنصار" width="180" height="70" />
    <h1>تعذّر تحميل المباراة</h1>
    <p>حاول مرة أخرى بعد لحظات.</p>
    <button className="button button-primary" onClick={() => reset()}>إعادة المحاولة</button>
  </main>;
}
