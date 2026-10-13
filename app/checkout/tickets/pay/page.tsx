import { Suspense } from "react";
import TicketPayClient from "./pay-client";
import "../../checkout.css";
import "../../../account.css";
import "../tickets-checkout.css";

export const metadata = { title: "دفع التذاكر | متجر الأنصار", robots: { index: false, follow: false } };

export default function TicketPayPage() {
  return <Suspense fallback={null}><TicketPayClient /></Suspense>;
}
