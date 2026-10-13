import { Suspense } from "react";
import TicketResultClient from "./result-client";
import "../../checkout.css";
import "../../../account.css";
import "../tickets-checkout.css";

export const metadata = { title: "تذاكرك | متجر الأنصار", robots: { index: false, follow: false } };

export default function TicketResultPage() {
  return <Suspense fallback={null}><TicketResultClient /></Suspense>;
}
