import { Suspense } from "react";
import OrdersClient from "./orders-client";
import "./orders.css";
import "../account.css";

export const metadata = { title: "طلباتي | متجر الأنصار", robots: { index: false, follow: false } };

export default function OrdersPage() {
  return <Suspense fallback={null}><OrdersClient /></Suspense>;
}
