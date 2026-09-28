"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "../../hooks/use-session";
import type { OrderSummary } from "../../lib/types";

const money = (value: number) => `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value)} ر.س`;
const date = (iso: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "medium" }).format(new Date(iso));
const PAYMENT: Record<OrderSummary["paymentStatus"], [string, string]> = {
  UNPAID: ["بانتظار الدفع", "bad"], PAID: ["مدفوع", "ok"], FAILED: ["فشل الدفع", "bad"], REFUNDED: ["مسترد", ""],
};
const FULFILLMENT: Record<OrderSummary["fulfillmentStatus"], string> = {
  PENDING: "قيد المراجعة", PREPARING: "قيد التجهيز", SHIPPED: "تم الشحن", FINISHED: "مكتمل", CANCELLED: "ملغي",
};

export default function OrdersClient() {
  const placed = useSearchParams().get("placed");
  const router = useRouter();
  const session = useSession();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState("");

  // Orders are private: once it is clear there is no session, drop any stale
  // data and leave the page. This also covers logging out while on this page.
  useEffect(() => {
    if (session.ready && !session.user) {
      setOrders(null);
      setError("");
      router.replace("/");
    }
  }, [session.ready, session.user, router]);

  useEffect(() => {
    if (!session.ready || !session.user) return;
    fetch("/api/orders", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) { session.setUser(null); return; }
        if (!response.ok) { setError("تعذّر تحميل الطلبات الآن."); return; }
        setOrders((await response.json()).orders as OrderSummary[]);
      })
      .catch(() => setError("تعذّر الاتصال. تحقق من الإنترنت."));
  }, [session.ready, session.user]); // eslint-disable-line react-hooks/exhaustive-deps

  return <main className="acc-page" dir="rtl">
    <div className="or-head"><h1>طلباتي</h1><div className="acc-row" style={{ flex: "0 0 auto" }}><a className="acc-link" href="/">العودة إلى المتجر</a>{session.user && <button className="acc-link" onClick={() => void session.logout()}>تسجيل الخروج</button>}</div></div>
    {placed && <p className="or-banner" role="status">تم استلام طلبك. شكرًا لك!</p>}
    {!session.ready && <p role="status">جارٍ التحميل…</p>}
    {error && <p className="acc-error" role="alert">{error}</p>}
    {session.user && orders?.length === 0 && <div className="acc-card"><p>لا توجد طلبات بعد.</p><a className="acc-primary" href="/">تسوّق الآن</a></div>}
    {session.user && orders?.map((order) => {
      const [label, tone] = PAYMENT[order.paymentStatus];
      const payable = (order.paymentStatus === "UNPAID" || order.paymentStatus === "FAILED") && order.fulfillmentStatus === "PENDING";
      return <article className="acc-card" key={order.id}>
        <div className="or-meta"><strong>طلب #{order.id.slice(0, 8)}</strong><span>{date(order.createdAt)}</span><span className={`acc-status ${tone}`}>{label}</span><span className="acc-status">{FULFILLMENT[order.fulfillmentStatus]}</span>{order.trackingNumber && <span>رقم التتبع: <bdi>{order.trackingNumber}</bdi></span>}</div>
        <ul className="or-lines">{order.items.map((item, index) => <li key={index}>{item.image && <img src={item.image} alt="" />}<div><div>{item.name} × {item.quantity}</div>{item.options.length > 0 && <div className="acc-note">{item.options.join(" · ")}</div>}</div><strong style={{ marginInlineStart: "auto" }}>{money(item.total)}</strong></li>)}</ul>
        <div className="or-meta"><span>التوصيل إلى: {order.deliveryAddress}</span><strong style={{ marginInlineStart: "auto", color: "inherit" }}>الإجمالي {money(order.total)}</strong></div>
        {payable && <a className="acc-primary" style={{ marginTop: 12 }} href={`/checkout/pay?order=${order.id}`}>ادفع الآن</a>}
      </article>;
    })}
  </main>;
}
