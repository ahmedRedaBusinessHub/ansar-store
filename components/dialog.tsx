"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import "./shop-dialogs.css";

let activeDialogs = 0;
let originalOverflow = "";

export function Dialog({ open, onClose, titleId, className = "", children }: {
  open: boolean; onClose: () => void; titleId: string; className?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    if (activeDialogs++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      dialog.close();
      if (--activeDialogs === 0) document.body.style.overflow = originalOverflow;
      // Restore after React removes the dialog, without stealing a new modal's focus.
      queueMicrotask(() => {
        if (dialog.open || !opener?.isConnected) return;
        const modal = document.querySelector("dialog[open]");
        if (!modal || modal.contains(opener)) opener.focus({ preventScroll: true });
      });
    };
  }, [open]);
  return <dialog ref={ref} dir="rtl" className={`sd-dialog ${className}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    {children}
  </dialog>;
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  return <button type="button" className="sd-icon" aria-label="إغلاق" title="إغلاق" onClick={onClose}><X size={22} /></button>;
}
