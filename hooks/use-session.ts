"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "../lib/types";

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const body = response.ok ? await response.json() : { user: null };
      setUser(body?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { user, ready, refresh, logout, setUser };
}
