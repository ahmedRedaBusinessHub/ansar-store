"use client";

/** Body of the error.tsx boundaries under /news, /gallery and /videos/[id] (web-api down while rendering). */
export function ContentError({ title, reset }: { title: string; reset: () => void }) {
  return <main className="initial-state">
    <img src="/images/logo.svg" alt="نادي الأنصار" width="180" height="70" />
    <h1>{title}</h1>
    <p>حاول مرة أخرى بعد لحظات.</p>
    <button className="button button-primary" onClick={() => reset()}>إعادة المحاولة</button>
  </main>;
}
