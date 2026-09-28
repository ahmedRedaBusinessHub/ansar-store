import { Suspense } from "react";
import ResultClient from "./result-client";
import "../checkout.css";
import "../../account.css";

export const metadata = { title: "نتيجة الدفع | متجر الأنصار", robots: { index: false, follow: false } };

export default function ResultPage() {
  return <Suspense fallback={null}><ResultClient /></Suspense>;
}
