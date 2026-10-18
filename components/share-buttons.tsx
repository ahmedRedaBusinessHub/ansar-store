"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import "./content.css";

/** Native share sheet when the browser has one; WhatsApp, X and copy-link always. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Decided after mount so server and first client render match.
  useEffect(() => { setCanShare(typeof navigator.share === "function"); }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    try { await navigator.share({ title, url }); } catch { /* dismissed */ }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* clipboard blocked */ }
  };

  return <div className="share-row">
    {canShare && <button type="button" className="share-button" onClick={() => void share()}><Share2 size={16} /> مشاركة</button>}
    <a className="share-button" href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer">واتساب</a>
    <a className="share-button" href={`https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">X</a>
    <button type="button" className="share-button" onClick={() => void copy()} aria-live="polite">
      {copied ? <><Check size={16} /> تم نسخ الرابط</> : <><Link2 size={16} /> نسخ الرابط</>}
    </button>
  </div>;
}
