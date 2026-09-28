import { Suspense } from "react";
import PayClient from "./pay-client";
import "../checkout.css";
import "../../account.css";

export const metadata = { title: "الدفع | متجر الأنصار", robots: { index: false, follow: false } };

export default function PayPage() {
  return <Suspense fallback={null}><PayClient /></Suspense>;
}
