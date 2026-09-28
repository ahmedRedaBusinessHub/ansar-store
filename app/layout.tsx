import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "متجر الأنصار | من المدينة، بكل فخر",
  description: "اكتشف مجموعة نادي الأنصار لموسم 2026/2027. أطقم للكبار والصغار بروح المدينة.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
