"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import type { SessionUser } from "../lib/types";
import { CloseButton, Dialog } from "./dialog";
import "../app/account.css";

type Step = "phone" | "code" | "name";

const ERRORS: Record<string, string> = {
  invalid_input: "تحقّق من البيانات المدخلة.",
  rate_limited: "طلبت رموزًا كثيرة. حاول بعد قليل.",
  otp_invalid: "رمز التحقق غير صحيح أو انتهت صلاحيته.",
  verification_expired: "انتهت صلاحية التحقق. أرسل رمزًا جديدًا ثم أكمل التسجيل.",
  account_inactive: "هذا الحساب غير نشط. تواصل مع النادي أو استخدم تطبيق الأنصار.",
  conflict: "هذا الرقم أو البريد مسجّل مسبقًا.",
  upstream_unavailable: "الخدمة غير متاحة الآن. حاول بعد قليل.",
};

/** Accepts 05XXXXXXXX, 5XXXXXXXX, 9665XXXXXXXX, +9665XXXXXXXX (Arabic digits too) or any +E.164 number. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\s()-]/g, "");
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: response.ok, data: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, data: { error: "upstream_unavailable" } };
  }
}

export function AuthDialog({ open, onClose, onSignedIn }: { open: boolean; onClose(): void; onSignedIn(user: SessionUser): void }) {
  return open ? <AuthContent onClose={onClose} onSignedIn={onSignedIn} /> : null;
}

function AuthContent({ onClose, onSignedIn }: { onClose(): void; onSignedIn(user: SessionUser): void }) {
  const titleId = useId();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [needsEmail, setNeedsEmail] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fail = (data: Record<string, unknown>) => setError(ERRORS[String(data.error)] ?? ERRORS.upstream_unavailable);
  const withEmail = needsEmail && email.trim() ? { email: email.trim() } : {};

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    const normalized = normalizePhone(phoneInput);
    if (!normalized) { setError("اكتب رقم جوال صحيحًا، مثل 05XXXXXXXX."); return; }
    setBusy(true); setError("");
    const result = await post("/api/auth/request-otp", { phone: normalized, ...withEmail });
    setBusy(false);
    if (!result.ok) { fail(result.data); return; }
    if (result.data.requiresEmail === true && !withEmail.email) { setNeedsEmail(true); setError("أدخل بريدك الإلكتروني لنرسل إليه رمز التحقق."); return; }
    setPhone(normalized); setCode(""); setStep("code");
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    const digits = code.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).trim();
    if (!/^\d{4,8}$/.test(digits)) { setError("أدخل رمز التحقق المكوّن من 4 أرقام."); return; }
    setBusy(true); setError("");
    const result = await post("/api/auth/verify-otp", { phone, otp: digits, ...withEmail });
    setBusy(false);
    if (!result.ok) { fail(result.data); return; }
    if (result.data.isNewUser === true) { setStep("name"); return; }
    onSignedIn(result.data.user as SessionUser);
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) { setError("اكتب اسمك (حرفان على الأقل)."); return; }
    setBusy(true); setError("");
    const result = await post("/api/auth/register", { phone, name: name.trim(), ...withEmail });
    setBusy(false);
    if (!result.ok) {
      fail(result.data);
      if (result.data.error === "verification_expired") setStep("phone");
      return;
    }
    onSignedIn(result.data.user as SessionUser);
  }

  return <Dialog open onClose={onClose} titleId={titleId} className="sd-policy">
    <header className="sd-header"><h2 id={titleId}>{step === "name" ? "أكمل حسابك" : "تسجيل الدخول"}</h2><CloseButton onClose={onClose} /></header>
    {step === "phone" && <form className="acc-form" onSubmit={sendCode} noValidate>
      <p className="acc-note">سجّل برقم جوالك المسجّل في تطبيق الأنصار، وسنرسل لك رمز تحقق.</p>
      <label className="acc-field">رقم الجوال<input dir="ltr" inputMode="tel" autoComplete="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="05XXXXXXXX" /></label>
      {needsEmail && <label className="acc-field">البريد الإلكتروني<input dir="ltr" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
      {error && <p className="acc-error" role="alert">{error}</p>}
      <button className="acc-primary" type="submit" disabled={busy}>{busy ? "جارٍ الإرسال…" : "إرسال رمز التحقق"}<ArrowLeft size={18} /></button>
    </form>}
    {step === "code" && <form className="acc-form" onSubmit={verify} noValidate>
      <p className="acc-note">أرسلنا رمز التحقق إلى <bdi dir="ltr">{phone}</bdi>.</p>
      <label className="acc-field">رمز التحقق<input dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} /></label>
      {error && <p className="acc-error" role="alert">{error}</p>}
      <button className="acc-primary" type="submit" disabled={busy}>{busy ? "جارٍ التحقق…" : "تأكيد"}</button>
      <div className="acc-row"><button type="button" className="acc-link" onClick={() => { setStep("phone"); setError(""); }}>تغيير الرقم</button><button type="button" className="acc-link" disabled={busy} onClick={() => void sendCode()}>إعادة إرسال الرمز</button></div>
    </form>}
    {step === "name" && <form className="acc-form" onSubmit={createAccount} noValidate>
      <p className="acc-note">مرحبًا بك في الأنصار! اكتب اسمك لإنشاء حسابك.</p>
      <label className="acc-field">الاسم<input autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
      {error && <p className="acc-error" role="alert">{error}</p>}
      <button className="acc-primary" type="submit" disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</button>
    </form>}
  </Dialog>;
}
